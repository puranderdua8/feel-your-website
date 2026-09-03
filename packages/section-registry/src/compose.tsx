import type { Locale, RouteSectionNode } from "@feel-your-website/content-core";
import { Fragment } from "react";

import { OUTLET_SECTION_KEY, RouteRenderProvider, type RouteRenderContext } from "./context.js";
import { renderSection } from "./registry.js";

export interface RenderCompositionOptions {
  /**
   * The route being rendered — params, pathname, breadcrumb chain. Passed to
   * every section as its `route` prop and published via context so nested
   * sections can read it with `useRouteParams()` etc. Omit outside a route.
   */
  readonly route?: RouteRenderContext;
  /**
   * What an {@link OUTLET_SECTION_KEY} node renders: the matched child route's
   * composition, for a parent layout. `null` renders nothing there (an empty
   * child); omitting the key entirely renders a visible placeholder, which is
   * what a CMS preview or a mis-authored leaf route wants.
   */
  readonly outlet?: React.ReactNode;
}

/**
 * Renders a route's section-instance tree for one locale.
 *
 * For each node: take its content for `locale` straight off the node (the
 * route owns it), render its slots recursively, and hand both — plus the route
 * context — to the section's component. A node with no content for this locale
 * renders the section's placeholder; a reserved `outlet` node renders
 * `options.outlet`.
 */
export function renderComposition(
  tree: readonly RouteSectionNode[],
  locale: Locale,
  options?: RenderCompositionOptions,
): React.JSX.Element {
  const body = (
    <>
      {tree.map((node) => (
        <Fragment key={node.instanceId}>{renderNode(node, locale, options)}</Fragment>
      ))}
    </>
  );

  return options?.route ? (
    <RouteRenderProvider value={options.route}>{body}</RouteRenderProvider>
  ) : (
    body
  );
}

function renderNode(
  node: RouteSectionNode,
  locale: Locale,
  options: RenderCompositionOptions | undefined,
): React.JSX.Element {
  if (node.sectionKey === OUTLET_SECTION_KEY) {
    return <>{options && "outlet" in options ? options.outlet : <OutletPlaceholder />}</>;
  }

  const slots: Record<string, React.ReactNode> = {};
  for (const [slotName, children] of Object.entries(node.slots)) {
    slots[slotName] = children.map((child) => (
      <Fragment key={child.instanceId}>{renderNode(child, locale, options)}</Fragment>
    ));
  }

  return renderSection(node.sectionKey, node.content[locale] ?? null, slots, options?.route);
}

/** Stand-in shown where a child route would render — CMS preview, or a leaf route carrying an outlet by mistake. */
function OutletPlaceholder(): React.JSX.Element {
  return (
    <div className="border-border text-muted-foreground rounded-[var(--radius)] border border-dashed p-4 text-sm">
      A nested route renders here.
    </div>
  );
}
