import type { ActionResult } from "@feel-your-website/action-core";
import type { AnalyticsEvent } from "@feel-your-website/analytics-core";
import { CONSENT_COOKIE_NAME, type ConsentStatus } from "@feel-your-website/consent-core";
import { treeHasOutlet, type JsonValue } from "@feel-your-website/content-core";
import { platformCatalog, resolvePermissions } from "@feel-your-website/rbac";
import type { SectionDataEntry } from "@feel-your-website/section-registry";
import { createServerFn } from "@tanstack/react-start";
import { getCookies } from "@tanstack/react-start/server";

import { isSupportedLocale, persistLocale, resolveLocale } from "@/i18n/strategy.server";

import {
  getActionInvoker,
  getAuthProvider,
  getContentAdapter,
  getAnalyticsSink,
} from "./adapters.js";
import { parseAnalyticsBatch } from "./analytics-ingest.js";
import { loadAnalyticsConfig, type AnalyticsConfig } from "./config/analytics.js";
import { assertSameOrigin } from "./http-guards.js";
import { resolveAndInvokeActionByRouteKey, type InvokeActionByKeyInput } from "./invoke-action.js";
import type { NavNode } from "./nav.js";
import { buildPublicBootstrap } from "./public-bootstrap.js";
import {
  deferredRouteContentSectionIds,
  loadRouteContentSectionData,
} from "./route-content-data.js";
import { resolveRouteByKey, type RouteContentResult } from "./route-content.js";

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

/**
 * One resolved bundle's own content (plan finding 3). No `chain`/`layers`:
 * each route level (layout, leaf) fetches and renders only its own bundle,
 * TanStack's own nested `<Outlet/>` does the composition, and breadcrumbs
 * come from `useMatches()` client-side.
 */
export interface RouteContent {
  readonly routeKey: string;
  /** This bundle's absolute path pattern, e.g. `/blog/:slug`. */
  readonly path: string;
  readonly locale: string;
  /** `:name` segment values, sanitised. `{}` for a static route. */
  readonly params: Record<string, string>;
  readonly tree: RouteContentResult["bundle"]["tree"];
  /** Whether this bundle's tree carries an `outlet` node — see `RouteBundle` docs. */
  readonly hasOutlet: boolean;
  readonly seo: RouteContentResult["seo"];
  readonly sectionData?: Readonly<Record<string, SectionDataEntry>>;
  readonly deferredSections?: string[];
}

/** Parses an untrusted `params` object into `Record<string, string>`, dropping non-string values. */
function parseParamsRecord(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

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
    const [{ userId, permissions }, { messages, nav, degraded }] = await Promise.all([
      resolveSessionPermissions(),
      buildPublicBootstrap(locale),
    ]);

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
 * Idempotency replay for {@link invokeActionByKey}: a completed invoke of an
 * `idempotent` action, keyed by `actionId\0requestId`. Process-local, so it
 * covers a double-click and an in-flight retry on the same instance, not a
 * fleet — a money/state action still needs an upstream `Idempotency-Key`.
 */
const invokeReplayCache = new Map<string, Promise<ActionResult>>();

/**
 * Looks the route up directly by its stable `routeKey`
 * (`ContentAdapter.getRouteByKey`), never by re-matching a path, and
 * validates `params` against *that bundle's own* `paramNames`. Returns
 * `null` for an unknown/unpublished key or an invalid param — both are
 * `notFound()` at the route layer.
 *
 * Section data is fetched for *this bundle's own tree only* — no ancestor
 * fan-out. Each route level (a generated layout or leaf file) calls this
 * independently; TanStack's own `<Outlet/>` composes the render, not a
 * server-side chain walk.
 */
export const loadRouteContent = createServerFn({ method: "GET" })
  .validator((input: unknown): { routeKey: string; params: Record<string, string> } => {
    const raw = (input ?? {}) as Record<string, unknown>;
    if (typeof raw.routeKey !== "string" || raw.routeKey.trim() === "") {
      throw new Error("routeKey is required.");
    }
    return { routeKey: raw.routeKey, params: parseParamsRecord(raw.params) };
  })
  .handler(async ({ data }): Promise<RouteContent | null> => {
    const locale = resolveLocale();
    const bundle = await getContentAdapter().getRouteByKey(data.routeKey);
    const resolved = resolveRouteByKey(bundle, locale, data.params);
    if (resolved === "not_found" || resolved === "invalid_params") return null;

    const sectionData = await loadRouteContentSectionData(
      resolved,
      resolved.bundle.path,
      locale,
      getActionInvoker(),
    );
    const deferredSections = deferredRouteContentSectionIds(resolved, resolved.bundle.path, locale);

    return {
      routeKey: resolved.bundle.routeKey,
      path: resolved.bundle.path,
      locale,
      params: resolved.params,
      tree: resolved.bundle.tree,
      hasOutlet: treeHasOutlet(resolved.bundle.tree),
      seo: resolved.seo,
      ...(Object.keys(sectionData).length > 0 ? { sectionData } : {}),
      ...(deferredSections.length > 0 ? { deferredSections } : {}),
    };
  });

/**
 * The client-refetch pass for one bundle's non-blocking sections, called
 * after mount for every id in {@link RouteContent.deferredSections}.
 */
export const loadSectionDataByKey = createServerFn({ method: "GET" })
  .validator((input: unknown): { routeKey: string; params: Record<string, string> } => {
    const raw = (input ?? {}) as Record<string, unknown>;
    if (typeof raw.routeKey !== "string" || raw.routeKey.trim() === "") {
      throw new Error("routeKey is required.");
    }
    return { routeKey: raw.routeKey, params: parseParamsRecord(raw.params) };
  })
  .handler(async ({ data }): Promise<Record<string, SectionDataEntry>> => {
    const locale = resolveLocale();
    const bundle = await getContentAdapter().getRouteByKey(data.routeKey);
    const resolved = resolveRouteByKey(bundle, locale, data.params);
    if (resolved === "not_found" || resolved === "invalid_params") return {};
    return loadRouteContentSectionData(resolved, resolved.bundle.path, locale, getActionInvoker(), {
      phase: "deferred",
    });
  });

/**
 * Fires the registered mutation a `mode: "action"` CTA points at.
 *
 * The client sends only the `routeKey` + `params` of the bundle it renders
 * inside, the firing node's `instanceId`, and a per-submit `requestId` — the
 * server looks the bundle up directly rather than re-deriving it from a
 * request path, reads the action id / input mapping / permission off that
 * node, and rebuilds the request body from re-sanitised route params. See
 * {@link resolveAndInvokeActionByRouteKey}.
 */
export const invokeActionByKey = createServerFn({ method: "POST" })
  .validator((input: unknown): InvokeActionByKeyInput => {
    const raw = (input ?? {}) as Record<string, unknown>;
    const requireString = (key: "routeKey" | "instanceId" | "requestId"): string => {
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
      routeKey: requireString("routeKey"),
      params: parseParamsRecord(raw.params),
      instanceId: requireString("instanceId"),
      requestId: requireString("requestId"),
      formInput,
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    assertSameOrigin();

    const locale = resolveLocale();
    const bundle = await getContentAdapter().getRouteByKey(data.routeKey);

    return resolveAndInvokeActionByRouteKey(data, {
      bundle,
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
