import { renderComposition, type RouteRenderContext } from "@feel-your-website/section-registry";
import type { ReactNode } from "react";

import type { RoutePage } from "@/server/bff";

/** Turns a resolved page's (already param-interpolated) SEO into `head()` meta / links. */
export function seoToHead(page: RoutePage): {
  meta: { title?: string; name?: string; property?: string; content?: string }[];
  links: { rel: string; href: string }[];
} {
  const seo = page.seo;
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

/**
 * Renders a resolved {@link RoutePage}: folds the render stack innermost-first so
 * each parent layout wraps the next through its `outlet` node, and publishes the
 * route context to every section.
 */
export function RoutePageView({ page }: { page: RoutePage }): React.JSX.Element {
  const route: RouteRenderContext = {
    params: page.params,
    pathname: page.pathname,
    pattern: page.pattern,
    chain: page.chain,
    locale: page.locale,
  };

  let rendered: ReactNode = null;
  for (let i = page.layers.length - 1; i >= 0; i--) {
    rendered = renderComposition(page.layers[i]!.tree, page.locale, { route, outlet: rendered });
  }

  return <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">{rendered}</main>;
}
