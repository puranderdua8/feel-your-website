import type { RouteSectionNode } from "@feel-your-website/content-core";
import {
  derivePreviewSectionData,
  renderComposition,
  type LinkSpec,
} from "@feel-your-website/section-registry";
import { ThemeProvider } from "@feel-your-website/theme/client";
import { useMemo } from "react";

/**
 * The preview has no router, so a CTA link is a plain, inert `<a>` — enough to
 * see the label and target, not to navigate.
 */
function renderPreviewLink(spec: LinkSpec) {
  return (
    <a
      href={spec.href}
      className={spec.className}
      {...(spec.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {spec.children}
    </a>
  );
}

/**
 * In-process preview: the exact `renderComposition` the shell uses, over the
 * draft tree at the active content locale. No iframe — a `ThemeProvider`
 * subtree fed the tree directly, since each node now carries its own content.
 */
export function RoutePreview({
  tree,
  locale,
}: {
  tree: readonly RouteSectionNode[];
  locale: string;
}) {
  // Stand-in external data for any data-backed section (e.g. `release-feed`):
  // its spec's `previewSample`, shaped by the same `project` the shell runs.
  // No network — recomputed synchronously as the draft changes.
  const sectionData = useMemo(() => derivePreviewSectionData([tree], locale), [tree, locale]);

  return (
    <div className="border-border overflow-hidden rounded-[var(--radius)] border">
      <p className="bg-muted text-muted-foreground border-border border-b px-3 py-1.5 text-xs">
        Preview · <code>{locale}</code>
      </p>
      <ThemeProvider theme="base">
        <div className="bg-background flex flex-col gap-8 p-6">
          {tree.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
          ) : (
            renderComposition(tree, locale, { renderLink: renderPreviewLink, sectionData })
          )}
        </div>
      </ThemeProvider>
    </div>
  );
}
