import { renderTemplate } from "@feel-your-website/section-registry";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Fragment } from "react";

import { loadRoutePage, type RoutePage } from "@/server/bff";

/**
 * The catch-all route: anything not claimed by a more specific file
 * (`index.tsx`, `admin.tsx`) falls through here. TanStack Router always
 * prefers a static match over a splat one, so this never shadows those.
 *
 * This is the piece that makes a CMS-authored route bundle actually appear
 * on the site — see `src/server/bff.ts`'s `loadRoutePage` for the manifest
 * lookup and `@feel-your-website/section-registry` for what turns each item
 * into markup. Before this file existed, `published_route_manifest` was real
 * and queryable but nothing in this app ever read it.
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
  component: RoutePage,
});

function RoutePage() {
  const page = Route.useLoaderData();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      {page.items.map(({ templateKey, content }) => (
        <Fragment key={templateKey}>{renderTemplate(templateKey, content)}</Fragment>
      ))}
    </main>
  );
}
