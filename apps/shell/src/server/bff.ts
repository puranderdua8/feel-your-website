import type { ActionResult } from "@feel-your-website/action-core";
import type { AnalyticsEvent } from "@feel-your-website/analytics-core";
import { CONSENT_COOKIE_NAME, type ConsentStatus } from "@feel-your-website/consent-core";
import { isContentAdapterError, type JsonValue } from "@feel-your-website/content-core";
import { BOOTSTRAP_MESSAGES } from "@feel-your-website/i18n-core";
import { platformCatalog, resolvePermissions } from "@feel-your-website/rbac";
import { createServerFn } from "@tanstack/react-start";
import { getCookies } from "@tanstack/react-start/server";

import { isSupportedLocale, persistLocale, resolveLocale } from "@/i18n/strategy.server";

import {
  getActionInvoker,
  getAnalyticsSink,
  getAuthProvider,
  getContentAdapter,
} from "./adapters.js";
import { parseAnalyticsBatch } from "./analytics-ingest.js";
import { loadAnalyticsConfig, type AnalyticsConfig } from "./config/analytics.js";
import { assertSameOrigin } from "./http-guards.js";
import { resolveAndInvokeAction, type InvokeActionInput } from "./invoke-action.js";
import { buildNav, type NavNode } from "./nav.js";
import { resolveRoutePage, type RoutePage } from "./resolve-route-page.js";
import { loadRouteSectionData } from "./route-page-data.js";

/**
 * The BFF.
 *
 * Everything the client needs goes through these server functions, and they
 * are the only code that touches an adapter. Going client→backend directly
 * would be less code and would hard-couple every screen to whichever backend
 * is in use, which is precisely what this platform is built to avoid.
 */

/**
 * The BFF never decides *how* the locale is determined — it asks the strategy.
 * That is what keeps switching between a cookie and a URL a change in one
 * place rather than across the server, the router and the UI.
 */

export interface BootstrapPayload {
  locale: string;
  messages: Record<string, string>;
  /** Resolved permission set, as an array for serialisation. */
  permissions: string[];
  /** Present only when signed in. */
  userId: string | null;
  /** True when messages came from the bootstrap set because the CMS failed. */
  degraded: boolean;
  /** The published-route forest for the site nav — param routes excluded. `[]` on a CMS outage. */
  nav: NavNode[];
  /** Client analytics config (all fields are browser-safe). `provider: "none"` unless configured. */
  analytics: AnalyticsConfig;
  /** The visitor's consent, read from the cookie server-side so the first client render matches. */
  consent: ConsentStatus;
}

export type { NavNode } from "./nav.js";
export type { RouteChainEntry, RouteLayer, RoutePage } from "./resolve-route-page.js";

/**
 * The signed-in user's id and their permissions, resolved against the code
 * catalog — a token can name a permission the code has since removed, and
 * granting one that no longer exists is the wrong direction to fail in.
 * Returns an empty set for an anonymous or failed session.
 */
async function resolveSessionPermissions(): Promise<{
  userId: string | null;
  permissions: ReadonlySet<string>;
}> {
  const session = await getAuthProvider()
    .getSession()
    .catch(() => null);

  const { permissions, unknown } = resolvePermissions(
    session
      ? [
          {
            id: "from-claims",
            name: "from-claims",
            permissions: session.permissions as never,
            createdAt: session.issuedAt,
            updatedAt: session.issuedAt,
          },
        ]
      : [],
    platformCatalog,
  );

  if (unknown.length > 0) {
    console.warn("[rbac] token carried unknown permissions:", unknown);
  }

  return { userId: session?.userId ?? null, permissions };
}

/**
 * Everything the shell needs to render its first frame: negotiated locale,
 * messages, and the resolved permission set.
 *
 * One call rather than three so the first paint is not gated on a waterfall.
 */
export const loadBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<BootstrapPayload> => {
    const locale = resolveLocale();
    const { userId, permissions } = await resolveSessionPermissions();

    let messages: Record<string, string> = { ...BOOTSTRAP_MESSAGES };
    let nav: NavNode[] = [];
    let degraded = false;

    try {
      const adapter = getContentAdapter();
      const [fromCms, headers] = await Promise.all([
        adapter.getMessages(locale),
        // `getRouteHeaders`, never `getRouteManifest` — this call is on every
        // SSR navigation and must not pull section rows.
        adapter.getRouteHeaders(),
      ]);
      messages = { ...messages, ...fromCms };
      nav = buildNav(headers, locale);
    } catch (error) {
      // A CMS outage must degrade to the bootstrap set and an empty nav, not to
      // a blank page. This is the whole reason that set exists.
      degraded = true;
      console.error(
        "[cms] content unavailable, serving bootstrap set:",
        isContentAdapterError(error) ? error.code : error,
      );
    }

    return {
      locale,
      messages,
      permissions: [...permissions],
      userId,
      degraded,
      nav,
      analytics: loadAnalyticsConfig(),
      consent: readConsentFromCookie(),
    };
  },
);

/** The consent choice stored in the cookie, or `"unknown"` — read on the server so SSR agrees. */
function readConsentFromCookie(): ConsentStatus {
  const value = getCookies()[CONSENT_COOKIE_NAME];
  return value === "granted" || value === "denied" ? value : "unknown";
}

/**
 * Persists the user's language choice.
 *
 * Written server-side so the very next request — including a full reload or a
 * fresh visit tomorrow — is server-rendered in the chosen language. A purely
 * client-side write would leave the first paint in the old locale.
 */
export const setLocale = createServerFn({ method: "POST" })
  .validator((input: unknown): { locale: string } => {
    const locale =
      typeof input === "object" && input !== null && "locale" in input
        ? (input as { locale: unknown }).locale
        : null;

    // Validated rather than trusted: this value is persisted and echoed
    // into rendered pages.
    if (!isSupportedLocale(locale)) {
      throw new Error(`Unsupported locale: ${String(locale)}`);
    }
    return { locale };
  })
  .handler(async ({ data }): Promise<{ locale: string }> => {
    assertSameOrigin();
    persistLocale(data.locale);
    return { locale: data.locale };
  });

/**
 * Resolves a request path against the published route manifest — the piece
 * that turns a CMS author publishing a route into an actual page. The matching,
 * parent-chain walk, param sanitising and SEO interpolation are the pure
 * {@link resolveRoutePage}; this wrapper just supplies the locale and manifest.
 *
 * Returns `null` for no match, a reserved path, or a hostile param — all of
 * which are `notFound()` at the route layer, not BFF errors to throw.
 *
 * When a section on the matched page references a query action, its external
 * data is fetched here — one fan-out under a shared budget — and attached as
 * {@link RoutePage.sectionData}, so the first paint carries it and no client
 * waterfall follows. A fan-out failure degrades to no `sectionData`, never a
 * 500: each such section renders its own fallback.
 */
export const loadRoutePage = createServerFn({ method: "GET" })
  .validator((input: unknown): { path: string } => {
    const path = (input as { path?: unknown })?.path;
    if (typeof path !== "string" || path.trim() === "") {
      throw new Error("path is required.");
    }
    return { path };
  })
  .handler(async ({ data }): Promise<RoutePage | null> => {
    const locale = resolveLocale();
    // `getRouteManifest` ignores its own locale argument — route structure is
    // shared across locales and every node ships content for all of them.
    const manifest = await getContentAdapter().getRouteManifest(locale);
    const page = resolveRoutePage(data.path, manifest, locale);
    if (!page) return null;

    const sectionData = await loadRouteSectionData(page, getActionInvoker());
    return Object.keys(sectionData).length > 0 ? { ...page, sectionData } : page;
  });

/**
 * Idempotency replay for {@link invokeAction}: a completed invoke of an
 * `idempotent` action, keyed by `actionId\0requestId`. Process-local, so it
 * covers a double-click and an in-flight retry on the same instance, not a
 * fleet — a money/state action still needs an upstream `Idempotency-Key`.
 */
const invokeReplayCache = new Map<string, Promise<ActionResult>>();

/**
 * Fires the registered mutation a `mode: "action"` CTA points at.
 *
 * The client sends only the pathname, the firing node's `instanceId` and a
 * per-submit `requestId`. The server re-resolves the route from published
 * content, reads the action id / input mapping / permission off that node, and
 * rebuilds the request body from re-sanitised route params — nothing about the
 * call is taken from the request. See {@link resolveAndInvokeAction}.
 */
export const invokeAction = createServerFn({ method: "POST" })
  .validator((input: unknown): InvokeActionInput => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const requireString = (key: "path" | "instanceId" | "requestId"): string => {
      const value = raw[key];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${key} is required.`);
      }
      return value;
    };
    const formInput =
      typeof raw.formInput === "object" && raw.formInput !== null && !Array.isArray(raw.formInput)
        ? (raw.formInput as Record<string, JsonValue>)
        : undefined;
    return {
      path: requireString("path"),
      instanceId: requireString("instanceId"),
      requestId: requireString("requestId"),
      formInput,
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    assertSameOrigin();

    const locale = resolveLocale();
    const manifest = await getContentAdapter().getRouteManifest(locale);

    return resolveAndInvokeAction(data, {
      manifest,
      locale,
      session: await resolveSessionPermissions(),
      invoker: getActionInvoker(),
      replayCache: invokeReplayCache,
    });
  });

/**
 * The first-party analytics collector. The client's `<AnalyticsProvider>` fans
 * its batched queue here as well as to the vendor adapter, so events still land
 * when an ad-blocker eats the vendor script.
 *
 * Lenient by design: a malformed batch yields `{ accepted: 0 }`, never a throw.
 * The events are structurally validated (`parseAnalyticsBatch`) and handed to
 * the configured {@link getAnalyticsSink}.
 */
export const ingestAnalytics = createServerFn({ method: "POST" })
  .validator((input: unknown): { events: AnalyticsEvent[] } => ({
    events: parseAnalyticsBatch(input),
  }))
  .handler(async ({ data }): Promise<{ accepted: number }> => {
    assertSameOrigin();
    if (data.events.length === 0) return { accepted: 0 };

    const delivered = await getAnalyticsSink()
      .deliver(data.events)
      .catch(() => false);
    return { accepted: delivered ? data.events.length : 0 };
  });
