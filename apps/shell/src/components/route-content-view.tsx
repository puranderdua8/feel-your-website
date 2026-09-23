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
import { RouteKeyProvider } from "@/route-key-context";
import { loadSectionDataByKey, type RouteContent } from "@/server/bff";

/** Marks every id as failed — the client-refetch pass errored, so those sections fall back. */
function allFailed(ids: readonly string[]): Record<string, SectionDataEntry> {
  return Object.fromEntries(ids.map((id) => [id, { ok: false, error: { code: "unavailable" } }]));
}

/** Turns a resolved bundle's (already param-interpolated) SEO into `head()` meta / links. */
export function seoToHead(content: RouteContent): {
  meta: { title?: string; name?: string; property?: string; content?: string }[];
  links: { rel: string; href: string }[];
} {
  const seo = content.seo;
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
 * Renders one resolved {@link RouteContent} — a single bundle's own tree, with
 * `outlet` substituted wherever the tree carries an outlet node. Each CMS
 * route level (a generated layout or leaf file) fetches and renders only its
 * own bundle; TanStack's nested `<Outlet/>` does the composition, so there is
 * no ancestor-chain fold here.
 *
 * `wrap` is baked in at generation time from `parentKey === null` (see
 * `codegen.ts`): the bundle with no CMS ancestor owns the page's `<main>`
 * landmark (and the `<Breadcrumbs/>` trail, built from `useMatches()`) once;
 * a nested layout or leaf renders straight into its ancestor's outlet
 * instead of nesting either.
 */
export function RouteContentView({
  content,
  outlet,
  wrap,
}: {
  content: RouteContent;
  outlet: ReactNode;
  wrap: boolean;
}): React.JSX.Element {
  const onSectionInView = useSectionView();

  // Data for non-blocking sections, fetched after mount. Reset per bundle.
  const [deferredData, setDeferredData] = useState<Record<string, SectionDataEntry>>({});

  useEffect(() => {
    setDeferredData({});
    if ((content.deferredSections?.length ?? 0) === 0) return;

    let cancelled = false;
    void loadSectionDataByKey({ data: { routeKey: content.routeKey, params: content.params } })
      .then((result) => {
        if (!cancelled) setDeferredData(result);
      })
      .catch(() => {
        if (!cancelled) setDeferredData(allFailed(content.deferredSections ?? []));
      });
    return () => {
      cancelled = true;
    };
  }, [content.routeKey, content.params, content.deferredSections]);

  const sectionData = useMemo(
    () => ({ ...content.sectionData, ...deferredData }),
    [content.sectionData, deferredData],
  );
  const pendingSections = useMemo(
    () => new Set((content.deferredSections ?? []).filter((id) => !(id in deferredData))),
    [content.deferredSections, deferredData],
  );

  const route: RouteRenderContext = {
    params: content.params,
    pathname: content.path,
    pattern: content.path,
    chain: [],
    locale: content.locale,
  };

  const rendered = renderComposition(content.tree, content.locale, {
    route,
    outlet,
    renderLink: renderCtaLink,
    renderActionCta,
    sectionData,
    pendingSections,
    onSectionInView,
  });

  return (
    <RouteKeyProvider value={{ routeKey: content.routeKey, params: content.params }}>
      {wrap ? (
        <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
          <Breadcrumbs />
          {rendered}
        </main>
      ) : (
        rendered
      )}
    </RouteKeyProvider>
  );
}
