import { isNotFound, notFound, Outlet, useLoaderData } from "@tanstack/react-router";

import { RouteContentView, seoToHead } from "@/components/route-content-view";
import { CMS_ROUTES } from "@/generated/cms-routes.js";
import { refreshOfflineRoute } from "@/offline-refresh";
import { loadRouteContent, type RouteContent } from "@/server/bff";
import { readOfflineLocale } from "@/server/offline-locale";
import { fromOfflineRouteData, type OfflineRouteData } from "@/server/offline-route-data";

/**
 * The shared runtime every generated `(cms)/**` file points at.
 * `routes:generate` (`apps/shell/scripts/routes/codegen.ts`) writes route
 * options inline so TanStack's static analysis of `createFileRoute(...)`
 * still works, but every generated file's loader/head/component reference
 * these same exports — one place to change how a CMS route resolves and
 * renders, not one per generated file.
 *
 * Bundle-scoped (plan finding 3): each route level fetches and renders only
 * its *own* bundle by `routeKey`, never a whole ancestor chain in one call.
 * A generated file closes over its own `routeKey` (and a `wrap` flag — see
 * `RouteContentView`'s doc comment) as literal arguments, so TanStack's
 * per-route code-splitting still sees a literal `loader:`/`head:`/`component:`
 * value — just one that's a small closure instead of a bare reference.
 *
 * A generated **leaf** file (no outlet, or the exact-index half of a layout
 * pair sharing its routeKey — see below) uses:
 *
 * ```ts
 * export const Route = createFileRoute("/(cms)/blog/$slug")({
 *   loader: (ctx) => cmsLoader(ctx, "blog-slug"),
 *   head: cmsHead,
 *   component: cmsRouteComponent(false),
 * });
 * ```
 *
 * A generated **layout** file (`route.tsx`, the half of the pair with an
 * outlet) fetches and renders the *same* bundle its sibling `index.tsx`
 * shares a `routeKey` with — the layout owns rendering it (with `<Outlet/>`
 * filling the outlet node), so the sibling `index.tsx` renders nothing:
 *
 * ```ts
 * export const Route = createFileRoute("/(cms)/blog")({
 *   loader: (ctx) => cmsLoader(ctx, "blog"),
 *   head: cmsHead,
 *   component: cmsLayoutRouteComponent(true),
 * });
 * ```
 */

/** Every `offline: true` routeKey in this build — `cmsLoader`'s offline fallback only applies to these. */
const OFFLINE_ROUTE_KEYS = new Set(
  CMS_ROUTES.filter((route) => route.offline).map((route) => route.routeKey),
);

/**
 * Fetches `/offline-data/<routeKey>.json` — the seed `generate-offline-data.ts`
 * wrote at build time and the service worker precached — for the visitor's
 * own locale. `null` if it's missing (an offline build with no seed for this
 * key, or the browser truly has nothing precached), which `cmsLoader` treats
 * the same as any other failure: it re-throws whatever the network attempt
 * itself threw.
 */
async function loadOfflineRouteContent(routeKey: string): Promise<RouteContent | null> {
  const response = await fetch(`/offline-data/${routeKey}.json`).catch(() => null);
  if (!response || !response.ok) return null;
  const data = (await response.json()) as OfflineRouteData;
  return fromOfflineRouteData(data, readOfflineLocale());
}

/**
 * Resolves one bundle by `routeKey`, validating `ctx.params` against it;
 * `notFound()` if it isn't published.
 *
 * `loadRouteContent` is a network call (a `_serverFn` request the service
 * worker's "bff" cache may or may not have anything for), so it can fail for
 * reasons that have nothing to do with the route itself — offline, with no
 * cached response for this exact request. For an `offline: true` route,
 * that specific failure falls back to the precached seed (plan finding 1)
 * rather than the generic error boundary; `notFound()` and any other route
 * are re-thrown unchanged.
 */
export async function cmsLoader(
  ctx: { params: Record<string, string> },
  routeKey: string,
): Promise<RouteContent> {
  try {
    const content = await loadRouteContent({ data: { routeKey, params: ctx.params } });
    if (!content) throw notFound();
    refreshOfflineRoute(content, OFFLINE_ROUTE_KEYS);
    return content;
  } catch (error) {
    if (isNotFound(error) || !OFFLINE_ROUTE_KEYS.has(routeKey)) throw error;
    const offline = await loadOfflineRouteContent(routeKey);
    if (!offline) throw error;
    return offline;
  }
}

/** The matched bundle's (already param-interpolated) SEO as `head()` meta/links. */
export function cmsHead({
  loaderData,
}: {
  loaderData?: RouteContent;
}): ReturnType<typeof seoToHead> {
  return loaderData ? seoToHead(loaderData) : { meta: [], links: [] };
}

/**
 * `strict: false` reads the nearest matched route's loader data without
 * needing that route's own `Route` singleton — every generated file gets its
 * own singleton from `createFileRoute`, so a component shared across all of
 * them can't call `Route.useLoaderData()` directly.
 *
 * Typed loosely on purpose: `strict: false` makes TanStack union
 * `ResolveUseLoaderData` over every registered route, and on this app's
 * route tree that union blows TypeScript's instantiation-depth limit
 * (TS2589). We already know the runtime shape — every `(cms)/**` file that
 * has a loader returns exactly `RouteContent` — so the hook is widened at
 * this one call site instead of fighting the inference.
 */
const useCmsLoaderData = useLoaderData as (opts: { strict: false }) => unknown;

/** A leaf: renders its own bundle's tree with nothing filling its outlet node, if it has one. */
export function cmsRouteComponent(wrap: boolean): () => React.JSX.Element {
  return function CmsRouteComponentInstance(): React.JSX.Element {
    const content = useCmsLoaderData({ strict: false }) as RouteContent;
    return <RouteContentView content={content} outlet={null} wrap={wrap} />;
  };
}

/** A layout: renders its own bundle's tree with the matched child route filling its outlet node. */
export function cmsLayoutRouteComponent(wrap: boolean): () => React.JSX.Element {
  return function CmsLayoutRouteComponentInstance(): React.JSX.Element {
    const content = useCmsLoaderData({ strict: false }) as RouteContent;
    return <RouteContentView content={content} outlet={<Outlet />} wrap={wrap} />;
  };
}

/**
 * The exact-index half of a layout pair (same `routeKey` as its sibling
 * `route.tsx`): the layout already fetches and renders that bundle, so this
 * file — which exists only to satisfy TanStack's index-route requirement —
 * renders nothing into the outlet it's matched into.
 */
export function NullRouteComponent(): null {
  return null;
}
