import { notFound, Outlet, useLoaderData } from "@tanstack/react-router";

import { RouteContentView, seoToHead } from "@/components/route-content-view";
import { loadRouteContent, type RouteContent } from "@/server/bff";

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

/** Resolves one bundle by `routeKey`, validating `ctx.params` against it; `notFound()` otherwise. */
export async function cmsLoader(
  ctx: { params: Record<string, string> },
  routeKey: string,
): Promise<RouteContent> {
  const content = await loadRouteContent({ data: { routeKey, params: ctx.params } });
  if (!content) throw notFound();
  return content;
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
