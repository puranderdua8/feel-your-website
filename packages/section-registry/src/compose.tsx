import type { Locale, RouteSectionNode } from "@feel-your-website/content-core";
import { Fragment } from "react";

import { renderSection } from "./registry.js";

/**
 * Renders a route's section-instance tree for one locale.
 *
 * For each node: take its content for `locale` straight off the node (the
 * route owns it), render its slots recursively, and hand both to the
 * section's component. A node with no content for this locale renders the
 * section's placeholder — there is no fallback to another locale and no
 * "global" content behind the instance to fall back to.
 */
export function renderComposition(
  tree: readonly RouteSectionNode[],
  locale: Locale,
): React.JSX.Element {
  return (
    <>
      {tree.map((node) => (
        <Fragment key={node.instanceId}>{renderNode(node, locale)}</Fragment>
      ))}
    </>
  );
}

function renderNode(node: RouteSectionNode, locale: Locale): React.JSX.Element {
  const slots: Record<string, React.ReactNode> = {};
  for (const [slotName, children] of Object.entries(node.slots)) {
    slots[slotName] = children.map((child) => (
      <Fragment key={child.instanceId}>{renderNode(child, locale)}</Fragment>
    ));
  }

  return renderSection(node.ref.key, node.content[locale] ?? null, slots);
}
