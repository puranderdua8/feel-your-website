import {
  interpolateSeo,
  treeHasOutlet,
  type RouteBundle,
  type RouteSectionNode,
  type RouteSeo,
} from "@feel-your-website/content-core";

import type { RouteContent } from "./bff.js";

/**
 * One `offline: true` bundle's precached seed (plan finding 1/10):
 * `generate-offline-data.ts` writes one of these per offline `routeKey` to
 * `dist/client/offline-data/<routeKey>.json`, and the service worker
 * precaches it. It is a *seed* — a successful `loadRouteContent` response
 * for the same route, while online, refreshes the cached copy (stale-while-
 * revalidate), so this is only what a visitor who has never been online for
 * this route sees.
 *
 * No `params`: `RouteBundle.offline` is only ever `true` on a param-less
 * route (`paramNames` empty, enforced in the database), so there is exactly
 * one file per offline routeKey, not one per param combination. `seo` keeps
 * every locale (unlike `RouteContent`'s single, already-interpolated
 * locale) — interpolation is a no-op with no params anyway, and the client
 * picks its own current locale out of this bag, same as `tree`'s per-node
 * content already does.
 */
export interface OfflineRouteData {
  readonly routeKey: string;
  readonly path: string;
  readonly tree: readonly RouteSectionNode[];
  readonly seo: Readonly<Record<string, RouteSeo>>;
  readonly hasOutlet: boolean;
}

export function toOfflineRouteData(bundle: RouteBundle): OfflineRouteData {
  return {
    routeKey: bundle.routeKey,
    path: bundle.path,
    tree: bundle.tree,
    seo: bundle.seo,
    hasOutlet: treeHasOutlet(bundle.tree),
  };
}

/**
 * The inverse of {@link toOfflineRouteData}: turns a precached offline seed
 * back into a `RouteContent`, for whichever locale the visitor currently
 * has — `cms-route.tsx`'s client-side fallback when `loadRouteContent` can't
 * be reached at all. `params` is always `{}` (offline routes never take
 * any), so interpolation is a no-op; it still runs, for the same reason
 * `resolveRouteByKey` always does: the `RouteContent` shape promises
 * interpolated values, never a raw `{{}}` template.
 */
export function fromOfflineRouteData(data: OfflineRouteData, locale: string): RouteContent {
  return {
    routeKey: data.routeKey,
    path: data.path,
    locale,
    params: {},
    tree: data.tree,
    hasOutlet: data.hasOutlet,
    seo: interpolateSeo(data.seo[locale] ?? {}, {}),
  };
}
