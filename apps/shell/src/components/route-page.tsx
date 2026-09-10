import {
  renderComposition,
  type RouteRenderContext,
  type SectionDataEntry,
} from "@feel-your-website/section-registry";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useSectionView } from "@/analytics/section-view";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { renderActionCta } from "@/components/button-action-form";
import { renderCtaLink } from "@/components/cta-link";
import { loadSectionData, type RoutePage } from "@/server/bff";

/** Marks every id as failed — the client-refetch pass errored, so those sections fall back. */
function allFailed(ids: readonly string[]): Record<string, SectionDataEntry> {
  return Object.fromEntries(ids.map((id) => [id, { ok: false, error: { code: "unavailable" } }]));
}

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
 *
 * A parent layer that has no `outlet` node is not a layout — wrapping the inner
 * content with it would render the parent's page instead of the matched route's
 * (the child would have nowhere to go). Such a layer is skipped: the matched
 * route renders standalone, its breadcrumb trail still showing the hierarchy.
 */
export function RoutePageView({ page }: { page: RoutePage }): React.JSX.Element {
  const onSectionInView = useSectionView();

  // Data for non-blocking sections, fetched after mount. Reset per route.
  const [deferredData, setDeferredData] = useState<Record<string, SectionDataEntry>>({});

  useEffect(() => {
    setDeferredData({});
    if ((page.deferredSections?.length ?? 0) === 0) return;

    let cancelled = false;
    void loadSectionData({ data: { path: page.pathname } })
      .then((result) => {
        if (!cancelled) setDeferredData(result);
      })
      .catch(() => {
        if (!cancelled) setDeferredData(allFailed(page.deferredSections ?? []));
      });
    return () => {
      cancelled = true;
    };
  }, [page.pathname, page.deferredSections]);

  const sectionData = useMemo(
    () => ({ ...page.sectionData, ...deferredData }),
    [page.sectionData, deferredData],
  );
  const pendingSections = useMemo(
    () => new Set((page.deferredSections ?? []).filter((id) => !(id in deferredData))),
    [page.deferredSections, deferredData],
  );

  const route: RouteRenderContext = {
    params: page.params,
    pathname: page.pathname,
    pattern: page.pattern,
    chain: page.chain,
    locale: page.locale,
  };

  let rendered: ReactNode = null;
  for (let i = page.layers.length - 1; i >= 0; i--) {
    const layer = page.layers[i]!;
    const isLeaf = i === page.layers.length - 1;
    if (!isLeaf && !layer.hasOutlet) continue;
    rendered = renderComposition(layer.tree, page.locale, {
      route,
      outlet: rendered,
      renderLink: renderCtaLink,
      renderActionCta,
      sectionData,
      pendingSections,
      onSectionInView,
    });
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <Breadcrumbs chain={page.chain} />
      {rendered}
    </main>
  );
}
