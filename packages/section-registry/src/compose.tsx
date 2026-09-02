import type { Content, RouteSectionNode, SectionRef } from "@feel-your-website/content-core";
import { Fragment } from "react";

import { sectionCatalog } from "./sections.js";
import { renderSection } from "./registry.js";

/**
 * Resolves a `SectionRef` to its content for the locale being rendered.
 * `null` is a valid answer — an unfilled variant renders a visible
 * placeholder, not nothing.
 */
export type ResolveSectionContent = (ref: SectionRef) => Content | null;

/**
 * Renders a route's section-instance tree.
 *
 * For each node: resolve its content, render its slots (recursively), and
 * hand both to the section's component. A slot left empty on the node
 * materialises its `SectionSlotSpec.default` at this point — never stored,
 * only rendered — so a card the author never touched still shows its default
 * icon.
 */
export function renderComposition(
  tree: readonly RouteSectionNode[],
  resolveContent: ResolveSectionContent,
): React.JSX.Element {
  return (
    <>
      {tree.map((node) => (
        <Fragment key={node.instanceId}>{renderNode(node, resolveContent)}</Fragment>
      ))}
    </>
  );
}

function renderNode(
  node: RouteSectionNode,
  resolveContent: ResolveSectionContent,
): React.JSX.Element {
  const def = sectionCatalog.byKey.get(node.ref.key);

  const slots: Record<string, React.ReactNode> = {};
  for (const slot of def?.slots ?? []) {
    const filled = node.slots[slot.name] ?? [];
    const effective: readonly RouteSectionNode[] =
      filled.length > 0
        ? filled
        : slot.default
          ? [
              {
                instanceId: `${node.instanceId}:${slot.name}:default`,
                ref: slot.default,
                slots: {},
              },
            ]
          : [];

    slots[slot.name] = effective.map((child) => (
      <Fragment key={child.instanceId}>{renderNode(child, resolveContent)}</Fragment>
    ));
  }

  return renderSection(node.ref.key, resolveContent(node.ref), slots);
}
