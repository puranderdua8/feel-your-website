import {
  InMemoryActionCacheStore,
  MemoryActionInvoker,
  type ActionInvoker,
  type ActionResult,
} from "@feel-your-website/action-core";
import {
  CachingActionInvoker,
  HttpActionInvoker,
  NetlifyBlobsActionCacheStore,
  parseHttpActionBindings,
} from "@feel-your-website/action-invoker-http";
import { actionCatalog } from "@feel-your-website/action-registry";
import { MockAuthProvider, type AuthProvider } from "@feel-your-website/auth";
import { SupabaseAuthProvider, type CookieAdapter } from "@feel-your-website/auth-supabase";
import { contractSeed, MemoryContentAdapter } from "@feel-your-website/content-adapter-memory";
import { SupabaseContentAdapter } from "@feel-your-website/content-adapter-supabase";
import { ConsoleAnalyticsSink, type AnalyticsSink } from "@feel-your-website/analytics-core";
import { MeasurementProtocolSink } from "@feel-your-website/analytics-sink-ga";
import type { ContentAdapter } from "@feel-your-website/content-core";
import { SECTION_QUERY_REGISTRY } from "@feel-your-website/section-registry";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";

import { loadActionConfig } from "./config/action.js";

/**
 * The dependency-injection point. There is exactly one.
 *
 * This is the only module in the app that names a concrete adapter. Every
 * route, component and server function depends on the `ContentAdapter` and
 * `AuthProvider` interfaces, so swapping the backend is a change here and
 * nowhere else. If a `supabase-js` import ever appears outside an adapter
 * package, the seam has leaked.
 */

export type ContentAdapterKind = "memory" | "supabase";
export type AuthProviderKind = "mock" | "supabase";

function resolveContentAdapterKind(): ContentAdapterKind {
  const configured = process.env.CONTENT_ADAPTER ?? "memory";
  if (configured === "memory" || configured === "supabase") return configured;

  throw new Error(`Unknown CONTENT_ADAPTER "${configured}". Expected "memory" or "supabase".`);
}

function resolveAuthProviderKind(): AuthProviderKind {
  const configured = process.env.AUTH_PROVIDER ?? "mock";
  if (configured === "mock" || configured === "supabase") return configured;

  throw new Error(`Unknown AUTH_PROVIDER "${configured}". Expected "mock" or "supabase".`);
}

/**
 * Reads `SUPABASE_URL`/`SUPABASE_ANON_KEY`, shared by both Supabase-backed
 * adapters. Throws with the variable name rather than passing `undefined`
 * through to a client constructor, which would fail later with a URL-parsing
 * error that does not say which setting is missing.
 */
function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when using the Supabase adapter. Check your .env.`);
  }
  return value;
}

/**
 * Translates `@feel-your-website/auth-supabase`'s framework-agnostic
 * `CookieAdapter` into TanStack Start's actual request.
 *
 * Kept here rather than its own module: `seam.test.ts` enforces that exactly
 * one file may import a concrete backend package, and this glue has to name
 * `@feel-your-website/auth-supabase` for the `CookieAdapter` type it
 * implements — so it lives inside the one file that is allowed to.
 */
function tanstackCookieAdapter(): CookieAdapter {
  return {
    getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),

    setAll: (cookies, headers) => {
      for (const { name, value, options } of cookies) {
        // `@supabase/ssr`'s `CookieOptions` comes from the `cookie` npm
        // package; TanStack's `setCookie` expects `cookie-es`'s
        // `CookieSerializeOptions`. Both describe the same RFC 6265
        // attributes (path, maxAge, httpOnly, secure, sameSite, …) — the
        // packages differ only in where `sameSite`'s boolean shorthand is
        // typed, which `CookieAdapter`'s options already widened to match.
        setCookie(name, value, options);
      }

      // Required by `@supabase/ssr`'s contract for `setAll`: a response that
      // sets an auth cookie must tell any CDN or reverse proxy not to cache
      // it, or one signed-in user's session can be served to another.
      for (const [key, value] of Object.entries(headers)) {
        setResponseHeader(key, value);
      }
    },
  };
}

/**
 * Always fails with `not_found`. The zero-config state, so an unset
 * `ACTION_INVOKER` needs no upstream and no credentials.
 */
class NullActionInvoker implements ActionInvoker {
  invoke(): Promise<ActionResult> {
    return Promise.resolve({ ok: false, code: "not_found" });
  }
}

let contentAdapter: ContentAdapter | null = null;
let authProvider: AuthProvider | null = null;
let actionInvoker: ActionInvoker | null = null;
let analyticsSink: AnalyticsSink | null = null;

export function getContentAdapter(): ContentAdapter {
  if (contentAdapter) return contentAdapter;

  const kind = resolveContentAdapterKind();
  contentAdapter =
    kind === "supabase"
      ? new SupabaseContentAdapter({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
        })
      : new MemoryContentAdapter(contractSeed);

  return contentAdapter;
}

export function getAuthProvider(): AuthProvider {
  if (authProvider) return authProvider;

  const kind = resolveAuthProviderKind();
  authProvider =
    kind === "supabase"
      ? new SupabaseAuthProvider({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
          // Lazy on purpose: `tanstackCookieAdapter()`'s `getAll`/`setAll`
          // read the *current* request's cookies each time they are called,
          // not at construction — so caching this provider below (built
          // once, reused across requests) stays correct. The cookie access
          // is what's per-request, not the provider instance.
          cookies: tanstackCookieAdapter(),
        })
      : new MockAuthProvider({
          accounts: [
            {
              userId: "user-surveyor",
              email: "surveyor@example.com",
              password: "demo",
              permissions: [],
            },
            {
              userId: "user-manager",
              email: "manager@example.com",
              password: "demo",
              permissions: ["manage:content", "manage:routes"],
            },
          ],
        });

  return authProvider;
}

/**
 * The registered-actions invoker: `none` (a no-op that always returns
 * `not_found`), `memory` (an echoing fake for local work), or `http` (real
 * upstreams, response-cached for queries). Config and its validation live in
 * `config/action.ts`; turning the decoded blob into `HttpActionBindings` and
 * constructing the invoker are here because this is the one file the seam
 * test lets name a concrete backend.
 */
export function getActionInvoker(): ActionInvoker {
  if (actionInvoker) return actionInvoker;

  const config = loadActionConfig();

  if (config.kind === "none") {
    actionInvoker = new NullActionInvoker();
  } else if (config.kind === "memory") {
    // Local-work invoker: seed the example `feed.releases` query from the
    // `release-feed` section's own `previewSample` (one source of stand-in
    // data), honouring the requested `limit`; every other id still echoes its
    // body so a mutation CTA round-trips.
    const sample = SECTION_QUERY_REGISTRY["release-feed"]?.previewSample;
    const releases = Array.isArray(sample) ? sample : [];
    actionInvoker = new MemoryActionInvoker({
      echoUnseeded: true,
      seed: releases.length
        ? {
            "feed.releases": (body) =>
              releases.slice(
                0,
                Math.max(0, typeof body.limit === "number" ? body.limit : releases.length),
              ),
          }
        : {},
    });
  } else {
    // `blobs` — a fleet-wide cache (Netlify Blobs), so a cached query response
    // is a hit on every instance including a cold one; `memory` — per warm
    // instance. Both are best-effort; the invoker degrades a store outage to
    // the no-cache path.
    const store =
      config.cache === "blobs"
        ? new NetlifyBlobsActionCacheStore()
        : new InMemoryActionCacheStore();
    actionInvoker = new CachingActionInvoker({
      inner: new HttpActionInvoker({
        catalog: actionCatalog,
        bindings: parseHttpActionBindings(config.rawBindings),
        hostAllowlist: config.hostAllowlist,
        firstPartyHosts: config.firstPartyHosts,
      }),
      catalog: actionCatalog,
      store,
    });
  }

  return actionInvoker;
}

/**
 * Destination for the first-party analytics collector (`ingestAnalytics`).
 * `console` (default) logs each batch; `ga` relays it to GA4 over the
 * Measurement Protocol (the ad-block-resilient path). Analytics is
 * non-essential, but a *misconfigured* sink is a deploy error, so an unknown
 * value — or `ga` without its credentials — fails here rather than silently.
 */
export function getAnalyticsSink(): AnalyticsSink {
  if (analyticsSink) return analyticsSink;

  const kind = process.env.ANALYTICS_SINK ?? "console";

  if (kind === "console") {
    analyticsSink = new ConsoleAnalyticsSink("[analytics:collector]");
    return analyticsSink;
  }

  if (kind === "ga") {
    const measurementId = process.env.ANALYTICS_GA_MEASUREMENT_ID?.trim();
    const apiSecret = process.env.ANALYTICS_MP_API_SECRET?.trim();
    if (!measurementId || !apiSecret) {
      throw new Error(
        'ANALYTICS_SINK="ga" needs ANALYTICS_GA_MEASUREMENT_ID and ANALYTICS_MP_API_SECRET.',
      );
    }
    analyticsSink = new MeasurementProtocolSink({ measurementId, apiSecret });
    return analyticsSink;
  }

  throw new Error(`Unknown ANALYTICS_SINK "${kind}". Expected "console" or "ga".`);
}

/** Test seam: forces the next call to rebuild from current env. */
export function resetAdapters(): void {
  contentAdapter = null;
  authProvider = null;
  actionInvoker = null;
  analyticsSink = null;
}
