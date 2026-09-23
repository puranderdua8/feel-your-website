import type { BootstrapPayload, RouteContent } from "@/server/bff";

/**
 * Stale-while-revalidate for the offline seeds `generate-offline-data.ts`
 * wrote at build time (plan finding 10): once a route or the root bootstrap
 * loads *successfully online*, its precached offline copy is refreshed to
 * match — otherwise an offline visitor would keep seeing whatever was true
 * at the last deploy, forever. The service worker itself does the actual
 * cache write (`sw-src.js`'s `offline-refresh` `BroadcastChannel`
 * listener); this only broadcasts, and only when there's a service worker
 * that could be listening — during SSR, or with no service worker
 * registered at all, both are silent no-ops.
 *
 * A `BroadcastChannel`, not `navigator.serviceWorker.controller.postMessage`:
 * empirically, in this app's browser-automation test environment,
 * `ServiceWorker.postMessage` → the worker's own `self.addEventListener
 * ("message", ...)` never actually delivered, while a same-name
 * `BroadcastChannel` round-tripped correctly every time. Broadcasting also
 * needs no reference to which client to notify — any tab hearing about a
 * fresher copy is reason enough to update the shared cache.
 */

let channel: BroadcastChannel | null = null;

function offlineRefreshChannel(): BroadcastChannel | null {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return null;
  channel ??= new BroadcastChannel("offline-refresh");
  return channel;
}

/** Called after a `loadRouteContent` success — a no-op unless `routeKey` is `offline: true`. */
export function refreshOfflineRoute(
  content: RouteContent,
  offlineRouteKeys: ReadonlySet<string>,
): void {
  if (!offlineRouteKeys.has(content.routeKey)) return;
  offlineRefreshChannel()?.postMessage({
    type: "REFRESH_OFFLINE_ROUTE",
    payload: {
      routeKey: content.routeKey,
      path: content.path,
      locale: content.locale,
      tree: content.tree,
      seo: content.seo,
      hasOutlet: content.hasOutlet,
    },
  });
}

/**
 * Called after a `loadBootstrap` success. Only `locale`/`messages`/`nav` are
 * ever sent — `permissions`/`userId`/`consent` are the visitor's own and
 * must never reach a cache another visitor's offline fallback could read.
 */
export function refreshOfflineBootstrap(bootstrap: BootstrapPayload): void {
  offlineRefreshChannel()?.postMessage({
    type: "REFRESH_OFFLINE_BOOTSTRAP",
    payload: { locale: bootstrap.locale, messages: bootstrap.messages, nav: bootstrap.nav },
  });
}
