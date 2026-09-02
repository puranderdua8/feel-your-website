import type { Content, RouteSectionNode, SectionRef } from "@feel-your-website/content-core";
import { renderComposition } from "@feel-your-website/section-registry";
import { ThemeProvider } from "@feel-your-website/theme/client";

/**
 * In-process preview: the exact `renderComposition` the shell uses, over the
 * draft tree and whatever content has been fetched or typed so far. No
 * iframe — a `ThemeProvider` subtree fed already-resolved data.
 */
export function RoutePreview({
  tree,
  resolveContent,
}: {
  tree: readonly RouteSectionNode[];
  resolveContent: (ref: SectionRef) => Content | null;
}) {
  return (
    <div className="border-border overflow-hidden rounded-[var(--radius)] border">
      <p className="bg-muted text-muted-foreground border-border border-b px-3 py-1.5 text-xs">
        Preview
      </p>
      <ThemeProvider theme="base">
        <div className="bg-background flex flex-col gap-8 p-6">
          {tree.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
          ) : (
            renderComposition(tree, resolveContent)
          )}
        </div>
      </ThemeProvider>
    </div>
  );
}
