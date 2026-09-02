import type { RouteSectionNode } from "@feel-your-website/content-core";
import { renderComposition } from "@feel-your-website/section-registry";
import { ThemeProvider } from "@feel-your-website/theme/client";

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
            renderComposition(tree, locale)
          )}
        </div>
      </ThemeProvider>
    </div>
  );
}
