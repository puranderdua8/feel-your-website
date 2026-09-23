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
// network is gone.
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith("/_serverFn/"),
  new workbox.strategies.NetworkFirst({
    cacheName: "bff",
    networkTimeoutSeconds: 3,
    plugins: [
      new workbox.expiration.ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
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

// The registration code (`service-worker.tsx`) posts SKIP_WAITING when the
// user accepts an update; skipWaiting/clientsClaim are deliberately never
// called automatically, so the new worker waits to be told to take over.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
