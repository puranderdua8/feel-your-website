import { notFound, useLoaderData } from "@tanstack/react-router";

import { RoutePageView, seoToHead } from "@/components/route-page";
import { loadRoutePage, type RoutePage } from "@/server/bff";

/**
 * The shared runtime every generated `(cms)/**` file points at.
 * `routes:generate` (`apps/shell/scripts/routes.ts`) writes route options
 * inline so TanStack's static analysis of `createFileRoute(...)` still works,
 * but every generated file's loader/head/component reference these same three
 * exports — one place to change how a CMS route resolves and renders, not one
 * per generated file.
 *
 * A generated **leaf** file (no outlet — the whole page, or the `index.tsx`
 * half of a layout pair) uses all three:
 *
 * ```ts
 * export const Route = createFileRoute("/(cms)/about")({
 *   loader: cmsLoader,
 *   head: cmsHead,
 *   component: CmsRouteComponent,
 * });
 * ```
 *
 * A generated **layout** file (`route.tsx`, the half of the pair with an
 * outlet) renders only `<Outlet/>` — no loader, no head, no
 * `CmsRouteComponent`. `RoutePageView` (below) already folds the whole
 * ancestor chain into one tree per request, the same way the catch-all splat
 * route it replaces always has, so the leaf that actually matches does all
 * the fetching and rendering; the layout file exists only to give TanStack a
 * place in the URL hierarchy to mount that leaf into.
 */

/** Resolves the current path against the published manifest; `notFound()` otherwise. */
export async function cmsLoader({
  location,
}: {
  location: { pathname: string };
}): Promise<RoutePage> {
  const page = await loadRoutePage({ data: { path: location.pathname } });
  if (!page) throw notFound();
  return page;
}

/** The matched route's (already param-interpolated) SEO as `head()` meta/links. */
export function cmsHead({ loaderData }: { loaderData?: RoutePage }): ReturnType<typeof seoToHead> {
  return loaderData ? seoToHead(loaderData) : { meta: [], links: [] };
}

/**
 * `strict: false` reads the nearest matched route's loader data without
 * needing that route's own `Route` singleton — every generated leaf file
 * gets its own singleton from `createFileRoute`, so a component shared
 * across all of them can't call `Route.useLoaderData()` directly.
 *
 * Typed loosely on purpose: `strict: false` makes TanStack union
 * `ResolveUseLoaderData` over every registered route, and on this app's
 * route tree that union blows TypeScript's instantiation-depth limit
 * (TS2589). We already know the runtime shape — every `(cms)/**` leaf's
 * loader returns exactly `RoutePage` — so the hook is widened at this one
 * call site instead of fighting the inference.
 */
const useCmsLoaderData = useLoaderData as (opts: { strict: false }) => unknown;

export function CmsRouteComponent(): React.JSX.Element {
  const page = useCmsLoaderData({ strict: false }) as RoutePage;
  return <RoutePageView page={page} />;
}
