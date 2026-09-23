/**
 * Source for the generated service worker (`generate-sw.mjs` injects the
 * precache manifest at the one `precacheAndRoute` call below and writes the
 * result to `dist/client/sw.js`).
 *
 * Hand-written rather than Workbox's declarative `generateSW` config: the
 * offline navigation fallback (plan finding 1 — an unvisited route, offline,
 * needs to resolve to the app shell, not the browser's own offline page)
 * requires `workbox-routing`'s `setCatchHandler`, which `generateSW`'s
 * declarative `runtimeCaching` schema has no way to express — only its fixed
 * set of known plugins (`expiration`, `cacheableResponse`, ...). Loaded via
 * `importScripts` a local copy of the Workbox runtime rather than bundling:
 * there is no bundler step between this file and `dist/client/sw.js`
 * (`injectManifest` only does the manifest substitution). `generate-sw.mjs`
 * copies that runtime into `dist/client/` (`copyWorkboxLibraries`, the same
 * thing `generateSW` did internally) and substitutes its path in for the
 * placeholder below — self-hosted, like every other asset this app serves,
 * rather than the official docs' CDN default.
 */
importScripts("__WORKBOX_LIBS_IMPORT__");

// Analytics must never be served from cache: a cached `gtag.js` or a cached
// collect beacon would double-count or replay stale events, and a cached
// ingest response is meaningless. These are `NetworkOnly`.
const ANALYTICS_ORIGINS = new Set([
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://analytics.google.com",
]);

/** The build's precache manifest — every fingerprinted asset plus `_shell.html`. */
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST);
workbox.precaching.cleanupOutdatedCaches();

workbox.routing.registerRoute(
  ({ url }) => ANALYTICS_ORIGINS.has(url.origin),
  new workbox.strategies.NetworkOnly(),
);

// Any mutating server fn (invokeActionByKey, setLocale, ingestAnalytics) —
// never cached, and never a fallback response for a failed POST.
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/_serverFn/"),
  new workbox.strategies.NetworkOnly(),
  "POST",
);

// Navigations: network first, falling back to the last good response for
// that URL. Network-first matters because content is CMS-driven and changes
// without a deploy — cache-first would serve stale copy for as long as the
// entry lived. An unvisited URL (nothing in "pages" yet) falls through to
// `setCatchHandler` below.
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  new workbox.strategies.NetworkFirst({
    cacheName: "pages",
    networkTimeoutSeconds: 3,
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

// BFF responses. Same reasoning: fresh when possible, last-known when the
// network is gone — except a response marked `Cache-Control: no-store`
// (`loadBootstrap`'s own, since it carries the visitor's permissions/userId):
// that one must never become the shared, cross-visitor response this cache
// would otherwise serve to whoever asks next.
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/_serverFn/"),
  new workbox.strategies.NetworkFirst({
    cacheName: "bff",
    networkTimeoutSeconds: 3,
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      {
        cacheWillUpdate: async ({ response }) =>
          response.headers.get("cache-control")?.includes("no-store") ? null : response,
      },
    ],
  }),
);

// The final fallback, once nothing above produced a response (offline, and
// nothing cached for this exact URL): a navigation gets the precached app
// shell — `router.tsx`'s client bootstrap re-matches the real URL and takes
// it from there — anything else (an asset, a GET server fn) just fails.
workbox.routing.setCatchHandler(async ({ event }) => {
  if (event.request.mode === "navigate") {
    return (await workbox.precaching.matchPrecache("/_shell.html")) ?? Response.error();
  }
  return Response.error();
});

/**
 * Stale-while-revalidate for the offline seeds `generate-offline-data.ts`
 * wrote at build time (plan finding 10): `offline-refresh.ts` broadcasts one
 * of these once `loadRouteContent`/`loadBootstrap` succeeds online, so the
 * seed a fresh install writes is not frozen at build time forever.
 *
 * A `BroadcastChannel`, not `client.postMessage`/the `self.addEventListener
 * ("message", ...)` used below for `SKIP_WAITING`: this channel is purely
 * for this best-effort refresh, kept separate so a bug in it can never touch
 * the update flow, and broadcasting needs no reference to which client sent
 * it — any tab hearing about a fresher copy is reason enough to update the
 * shared cache.
 */
const offlineRefreshChannel = new BroadcastChannel("offline-refresh");

offlineRefreshChannel.addEventListener("message", (event) => {
  if (event.data?.type === "REFRESH_OFFLINE_ROUTE") {
    void refreshOfflineRoute(event.data.payload);
  } else if (event.data?.type === "REFRESH_OFFLINE_BOOTSTRAP") {
    void refreshOfflineBootstrap(event.data.payload);
  }
});

/**
 * Only this locale's own `seo` changes; whatever other locales are already
 * in the cached seed are kept, since `payload` only ever carries the
 * visitor's own.
 */
async function refreshOfflineRoute(payload) {
  const url = `/offline-data/${payload.routeKey}.json`;
  // Precache entries are keyed by their revisioned URL
  // (`?__WB_REVISION__=...`), not the bare one — write to whatever key the
  // precache route itself will actually look up, or the bare URL isn't found
  // by a plain `fetch()` and this refresh silently never takes effect.
  // `getCacheKeyForURL` returns `undefined` only when nothing was ever
  // precached at this URL (no offline route in this build) — the bare URL
  // is a reasonable one-off cache entry for that case.
  const cacheKey = workbox.precaching.getCacheKeyForURL(url) ?? url;
  const cache = await caches.open(workbox.core.cacheNames.precache);
  const existing = await cache.match(cacheKey);
  const existingSeo = existing ? (await existing.json()).seo : {};
  const body = {
    routeKey: payload.routeKey,
    path: payload.path,
    tree: payload.tree,
    seo: { ...existingSeo, [payload.locale]: payload.seo },
    hasOutlet: payload.hasOutlet,
  };
  await cache.put(
    cacheKey,
    new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
  );
}

/** `refreshOfflineRoute`'s counterpart for the root loader's per-locale bootstrap seed. */
async function refreshOfflineBootstrap(payload) {
  const url = `/offline-data/_bootstrap-${payload.locale}.json`;
  const cacheKey = workbox.precaching.getCacheKeyForURL(url) ?? url;
  const cache = await caches.open(workbox.core.cacheNames.precache);
  const body = { locale: payload.locale, messages: payload.messages, nav: payload.nav };
  await cache.put(
    cacheKey,
    new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
  );
}

// The registration code (`service-worker.tsx`) posts this when the user
// accepts an update; skipWaiting/clientsClaim are deliberately never called
// automatically, so the new worker waits to be told to take over.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
