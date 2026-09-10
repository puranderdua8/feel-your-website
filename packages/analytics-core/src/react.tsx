"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import { createJourneyCounter } from "./journey.js";
import { redactPath } from "./redact.js";
import { resolveClickTarget } from "./resolve-click-target.js";
import { deriveSession, isSampled, type SessionState } from "./session.js";
import type {
  AnalyticsAdapter,
  AnalyticsEvent,
  AnalyticsEventBody,
  ClickTarget,
  LinkKind,
} from "./types.js";

const SESSION_STORAGE_KEY = "fyw.analytics.session";
const DEFAULT_FLUSH_MS = 15_000;
/** Cap the collector queue so a dead endpoint can't grow it without bound. */
const MAX_QUEUE = 200;

function loadSession(): SessionState | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.startedAt === "number" &&
      typeof parsed.lastSeenAt === "number"
    ) {
      return { id: parsed.id, startedAt: parsed.startedAt, lastSeenAt: parsed.lastSeenAt };
    }
  } catch {
    // sessionStorage unavailable or corrupt — start fresh.
  }
  return null;
}

function saveSession(state: SessionState): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: a session that can't persist just restarts on reload.
  }
}

function randomId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface AnalyticsApi {
  /**
   * Record one event. The provider stamps the envelope (session id, monotonic
   * `seq`, `ts`, redacted `path`) and — only when consent is granted and the
   * session is in the sample — hands it to the adapter and queues it for the
   * collector. The single consent gate lives here.
   */
  emit(body: AnalyticsEventBody): void;
  /** Attach a user id to the session (passed straight to the adapter). */
  identify(userId: string): void;
}

const AnalyticsContext = createContext<AnalyticsApi | null>(null);

export interface AnalyticsProviderProps {
  children: ReactNode;
  /** The vendor adapter. `NoopAnalyticsAdapter` when no provider is configured. */
  adapter: AnalyticsAdapter;
  /** Whether the visitor has granted consent. Re-`init`s the adapter when it changes. */
  consentGranted: boolean;
  /**
   * Host-supplied transport for the first-party collector. When set, every
   * emitted event is also queued and this is called with a batch on the flush
   * timer, on `visibilitychange` → hidden, and on `pagehide`. The host owns
   * how the batch is sent (a server fn, `fetch`, `sendBeacon`, …).
   */
  sendBatch?: (events: readonly AnalyticsEvent[]) => void;
  /** `0..1`; a session outside the sample emits nothing. Default `1`. */
  sampleRate?: number;
  /** Flush the collector queue this often while the page is visible. Default 15s. */
  flushIntervalMs?: number;
  /** Injection seams for tests. */
  now?: () => number;
  newId?: () => string;
}

export function AnalyticsProvider({
  children,
  adapter,
  consentGranted,
  sendBatch,
  sampleRate = 1,
  flushIntervalMs = DEFAULT_FLUSH_MS,
  now = Date.now,
  newId = randomId,
}: AnalyticsProviderProps): React.JSX.Element {
  const sessionRef = useRef<SessionState | null>(null);
  const journeyRef = useRef(createJourneyCounter());
  const queueRef = useRef<AnalyticsEvent[]>([]);
  const sampledRef = useRef(true);

  // Latest-value refs so the effects/callbacks below need not list these as deps.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const consentRef = useRef(consentGranted);
  consentRef.current = consentGranted;
  const nowRef = useRef(now);
  nowRef.current = now;
  const newIdRef = useRef(newId);
  newIdRef.current = newId;
  const sampleRateRef = useRef(sampleRate);
  sampleRateRef.current = sampleRate;
  const sendBatchRef = useRef(sendBatch);
  sendBatchRef.current = sendBatch;

  // Idempotent — first caller wins. A child tracker's mount effect can fire
  // before this provider's, so `emit` must be able to bootstrap the session
  // itself rather than drop the first event.
  const ensureSession = useCallback((): SessionState => {
    if (!sessionRef.current) {
      const session = deriveSession({
        previous: loadSession(),
        now: nowRef.current(),
        freshId: newIdRef.current,
      });
      sessionRef.current = session;
      saveSession(session);
      sampledRef.current = isSampled(session.id, sampleRateRef.current);
    }
    return sessionRef.current;
  }, []);

  // Session first, then (re)init the adapter whenever consent changes.
  useEffect(() => {
    ensureSession();
    void Promise.resolve(adapterRef.current.init({ consentGranted }));
  }, [consentGranted, ensureSession]);

  const flush = useCallback(() => {
    const events = queueRef.current;
    queueRef.current = [];
    if (events.length === 0 || !sendBatchRef.current) return;
    try {
      sendBatchRef.current(events);
    } catch {
      // A dropped batch is acceptable — the adapter path is the primary one.
    }
  }, []);

  // Periodic flush + flush on the page going away.
  useEffect(() => {
    const timer = setInterval(flush, flushIntervalMs);
    const onPageHide = (): void => flush();
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush, flushIntervalMs]);

  const api = useMemo<AnalyticsApi>(
    () => ({
      emit(body: AnalyticsEventBody): void {
        const previous = ensureSession();
        // The one consent gate.
        if (!consentRef.current || !sampledRef.current) return;

        const session = deriveSession({
          previous,
          now: nowRef.current(),
          freshId: newIdRef.current,
        });
        sessionRef.current = session;
        saveSession(session);
        if (session.id !== previous.id) {
          journeyRef.current = createJourneyCounter();
          sampledRef.current = isSampled(session.id, sampleRateRef.current);
        }

        const event: AnalyticsEvent = {
          ...body,
          sessionId: session.id,
          seq: journeyRef.current.next(session.id),
          ts: nowRef.current(),
          path: redactPath(typeof window !== "undefined" ? window.location.pathname : "/"),
        };

        try {
          adapterRef.current.track(event);
        } catch {
          // An adapter must never break the page; if it does, drop the event.
        }

        if (sendBatchRef.current) {
          if (queueRef.current.length >= MAX_QUEUE) queueRef.current.shift();
          queueRef.current.push(event);
        }
      },
      identify(userId: string): void {
        try {
          adapterRef.current.identify(userId);
        } catch {
          // ignore
        }
      },
    }),
    [ensureSession],
  );

  return <AnalyticsContext.Provider value={api}>{children}</AnalyticsContext.Provider>;
}

/** The analytics API. Throws outside an `<AnalyticsProvider>`. */
export function useAnalytics(): AnalyticsApi {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used within an <AnalyticsProvider>.");
  return ctx;
}

/**
 * Emits a `page` event whenever `path` changes — once on mount for a non-null
 * path, then on every distinct value. A re-render with the same path emits
 * nothing (dedupe). `document.referrer` rides on the first page of the session
 * only.
 *
 * The host supplies `path` from its own router (e.g. a `useRouterState`
 * selector), so this package stays router-agnostic.
 */
export function usePageview(path: string | null): void {
  const { emit } = useAnalytics();
  const lastPath = useRef<string | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (path === null || path === lastPath.current) return;
    lastPath.current = path;

    const referrer =
      isFirst.current && typeof document !== "undefined" && document.referrer
        ? document.referrer
        : undefined;
    isFirst.current = false;

    emit(referrer ? { type: "page", referrer } : { type: "page" });
  }, [path, emit]);
}

const INTERACTIVE_TAGS = new Set(["a", "button", "input", "select", "textarea", "summary"]);

/** A click is worth an event only when it landed on something interactive. */
function isTrackable(target: ClickTarget): boolean {
  return (
    target.href !== undefined ||
    target.role !== undefined ||
    target.analyticsId !== undefined ||
    INTERACTIVE_TAGS.has(target.tag)
  );
}

export interface ClickTrackingOptions {
  /** Classifies a link's `href` into a {@link LinkKind}. Omitted, `linkKind` is left off. */
  readonly classifyHref?: (href: string) => LinkKind;
}

/**
 * Installs a single capture-phase listener on `document` and emits a `click`
 * event for every primary-button click that lands on something interactive
 * (a link, a button, a `[role]`, a `[data-analytics-id]`, a form control).
 * Clicks on inert page chrome are ignored. One listener for the whole page —
 * the section registry never has to know analytics exists.
 */
export function useClickTracking(options: ClickTrackingOptions = {}): void {
  const { emit } = useAnalytics();
  const classifyRef = useRef(options.classifyHref);
  classifyRef.current = options.classifyHref;

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (event.button !== 0) return;
      const body = resolveClickTarget(event.target, { classifyHref: classifyRef.current });
      if (body && isTrackable(body.target)) emit({ type: "click", ...body });
    };

    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [emit]);
}
