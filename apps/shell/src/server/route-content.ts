import { interpolateSeo, type RouteBundle, type RouteSeo } from "@feel-your-website/content-core";

import { sanitizeParam } from "./resolve-route-page.js";

/**
 * The bundle-scoped counterpart to `resolve-route-page.ts`'s `resolveRoutePage`
 * (plan finding 3): a caller that already knows *which* route it means — a
 * generated route file's own loader, an action invocation, a deferred
 * section-data fetch — looks the bundle up by its stable `routeKey`
 * (`ContentAdapter.getRouteByKey`, never by re-deriving identity from a
 * request path) and validates params against *that bundle's own*
 * `paramNames`. There is no ancestor-chain walk here: each route level
 * (layout or leaf) resolves and renders only its own bundle, TanStack's own
 * nested `<Outlet/>` does the composition, and breadcrumbs come from
 * `useMatches()` client-side — none of that needs a `chain` computed here.
 */

export interface RouteContentResult {
  readonly bundle: RouteBundle;
  /** This bundle's own `:name` params, sanitised. `{}` for a static route. */
  readonly params: Record<string, string>;
  /** This bundle's SEO for `locale`, with `{{param}}` already interpolated. */
  readonly seo: RouteSeo;
}

/** Why {@link resolveRouteByKey} could not produce a result — both are `notFound()` to a visitor. */
export type ResolveRouteByKeyError = "not_found" | "invalid_params";

/**
 * `bundle` is `getContentAdapter().getRouteByKey(routeKey)`'s result — already
 * `undefined` for an unpublished or unknown key, so "not found" and "not
 * published" are the same outcome by construction. `rawParams` is whatever
 * the caller (a router's typed `params`, or an untrusted request body) sent;
 * every one of `bundle.paramNames` must be present and pass
 * {@link sanitizeParam}, or the whole resolution fails — a partially-hostile
 * param set is not a page with some data missing, it's `notFound()`.
 */
export function resolveRouteByKey(
  bundle: RouteBundle | undefined,
  locale: string,
  rawParams: Readonly<Record<string, string>>,
): RouteContentResult | ResolveRouteByKeyError {
  if (!bundle) return "not_found";

  const params: Record<string, string> = {};
  for (const name of bundle.paramNames) {
    const raw = rawParams[name];
    if (typeof raw !== "string") return "invalid_params";
    const clean = sanitizeParam(raw);
    if (clean === null) return "invalid_params";
    params[name] = clean;
  }

  return {
    bundle,
    params,
    seo: interpolateSeo(bundle.seo[locale] ?? {}, params),
  };
}
