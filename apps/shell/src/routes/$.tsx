import type { SectionRef } from "@feel-your-website/content-core";
import { renderComposition } from "@feel-your-website/section-registry";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { loadRoutePage, type RoutePage } from "@/server/bff";

/**
 * The catch-all route: anything not claimed by a more specific file
 * (`index.tsx`, `admin.tsx`) falls through here. TanStack Router always
 * prefers a static match over a splat one, so this never shadows those.
 *
 * This is the piece that makes a CMS-authored route appear on the site — see
 * `src/server/bff.ts`'s `loadRoutePage` for the manifest lookup and
 * `@feel-your-website/section-registry`'s `renderComposition` for what turns
 * the section tree into markup.
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

function refKey(ref: SectionRef): string {
  return JSON.stringify([ref.key, ref.variant]);
}

function RoutePage() {
  const page = Route.useLoaderData();

  const byRef = new Map(page.content.map((entry) => [refKey(entry.ref), entry.content]));
  const resolveContent = (ref: SectionRef) => byRef.get(refKey(ref)) ?? null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      {renderComposition(page.tree, resolveContent)}
    </main>
  );
}
