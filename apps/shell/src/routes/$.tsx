import { createFileRoute, notFound } from "@tanstack/react-router";

import { RoutePageView, seoToHead } from "@/components/route-page";
import { loadRoutePage, type RoutePage } from "@/server/bff";

/**
 * The catch-all route: anything not claimed by a more specific file
 * (`index.tsx`, `admin.tsx`) falls through here. TanStack Router always
 * prefers a static match over a splat one, so this never shadows those.
 *
 * This is the piece that makes a CMS-authored route appear on the site —
 * `src/server/bff.ts`'s `loadRoutePage` matches the pathname against every
 * published pattern (`:param` and all), walks the parent chain, and returns the
 * nested render stack as `layers`. `RoutePageView` folds those through
 * `renderComposition` — each parent layer wrapping the next via its `outlet`
 * node — and `head()` emits the (already param-interpolated) SEO metadata.
 */
export const Route = createFileRoute("/$")({
  loader: async ({ location }): Promise<RoutePage> => {
    const page = await loadRoutePage({ data: { path: location.pathname } });
    // `notFound()` is what the root route's own `notFoundComponent` renders
    // for — a path with no published bundle is exactly that case, not a BFF
    // error to throw past the router.
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => (loaderData ? seoToHead(loaderData) : {}),
  component: RouteComponent,
});

function RouteComponent() {
  return <RoutePageView page={Route.useLoaderData()} />;
}
