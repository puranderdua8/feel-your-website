import type { RouteSeo } from "@feel-your-website/content-core";
import { renderComposition } from "@feel-your-website/section-registry";
import { createFileRoute, notFound } from "@tanstack/react-router";

import { loadRoutePage, type RoutePage } from "@/server/bff";

/**
 * The catch-all route: anything not claimed by a more specific file
 * (`index.tsx`, `admin.tsx`) falls through here. TanStack Router always
 * prefers a static match over a splat one, so this never shadows those.
 *
 * This is the piece that makes a CMS-authored route appear on the site — see
 * `src/server/bff.ts`'s `loadRoutePage` for the manifest lookup,
 * `@feel-your-website/section-registry`'s `renderComposition` for what turns
 * the section tree into markup, and `head()` below for the CMS-authored SEO
 * metadata.
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
  head: ({ loaderData }) => (loaderData ? seoToHead(loaderData.seo) : {}),
  component: RoutePage,
});

/** Turns a route's `RouteSeo` into the `meta` / `links` a `head()` returns. */
function seoToHead(seo: RouteSeo): {
  meta: { title?: string; name?: string; property?: string; content?: string }[];
  links: { rel: string; href: string }[];
} {
  const meta: { title?: string; name?: string; property?: string; content?: string }[] = [];
  const links: { rel: string; href: string }[] = [];

  if (seo.title) {
    meta.push({ title: seo.title }, { property: "og:title", content: seo.title });
  }
  if (seo.description) {
    meta.push(
      { name: "description", content: seo.description },
      { property: "og:description", content: seo.description },
    );
  }
  if (seo.keywords && seo.keywords.length > 0) {
    meta.push({ name: "keywords", content: seo.keywords.join(", ") });
  }
  if (seo.robots) meta.push({ name: "robots", content: seo.robots });
  if (seo.ogImage) meta.push({ property: "og:image", content: seo.ogImage });
  if (seo.canonical) links.push({ rel: "canonical", href: seo.canonical });

  return { meta, links };
}

function RoutePage() {
  const page = Route.useLoaderData();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      {renderComposition(page.tree, page.locale)}
    </main>
  );
}
