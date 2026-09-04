import type { JsonValue, Locale, RouteSectionNode } from "@feel-your-website/content-core";
import { OUTLET_SECTION_KEY } from "@feel-your-website/section-registry";

/**
 * Immutable edits on a `RouteSectionNode[]` keyed by `instanceId`. The route
 * editor holds the whole tree in one state value and re-derives everything
 * (preview, publish check) from it, so every mutation returns a new tree.
 */

/** A fresh node with a client-minted uuid and no content yet. */
export function newNode(sectionKey: string): RouteSectionNode {
  return { instanceId: crypto.randomUUID(), sectionKey, content: {}, slots: {} };
}

/** Replaces one locale's field bag on a node, leaving its other locales intact. */
export function setNodeContent(
  tree: readonly RouteSectionNode[],
  instanceId: string,
  locale: Locale,
  fields: Readonly<Record<string, JsonValue>>,
): RouteSectionNode[] {
  return updateNode(tree, instanceId, (node) => ({
    ...node,
    content: { ...node.content, [locale]: fields },
  }));
}

export function findNode(
  tree: readonly RouteSectionNode[],
  instanceId: string,
): RouteSectionNode | null {
  for (const node of tree) {
    if (node.instanceId === instanceId) return node;
    for (const children of Object.values(node.slots)) {
      const hit = findNode(children, instanceId);
      if (hit) return hit;
    }
  }
  return null;
}

/** Replaces the node with `instanceId` by `updater(node)`; `null` deletes it. */
export function updateNode(
  tree: readonly RouteSectionNode[],
  instanceId: string,
  updater: (node: RouteSectionNode) => RouteSectionNode | null,
): RouteSectionNode[] {
  const out: RouteSectionNode[] = [];
  for (const node of tree) {
    if (node.instanceId === instanceId) {
      const next = updater(node);
      if (next) out.push(next);
      continue;
    }
    const slots: Record<string, readonly RouteSectionNode[]> = {};
    let changed = false;
    for (const [slot, children] of Object.entries(node.slots)) {
      const nextChildren = updateNode(children, instanceId, updater);
      slots[slot] = nextChildren;
      if (nextChildren !== children) changed = true;
    }
    out.push(changed ? { ...node, slots } : node);
  }
  return out;
}

export function removeNode(
  tree: readonly RouteSectionNode[],
  instanceId: string,
): RouteSectionNode[] {
  return updateNode(tree, instanceId, () => null);
}

export function addSlotChild(
  tree: readonly RouteSectionNode[],
  parentId: string,
  slot: string,
  child: RouteSectionNode,
): RouteSectionNode[] {
  return updateNode(tree, parentId, (node) => ({
    ...node,
    slots: { ...node.slots, [slot]: [...(node.slots[slot] ?? []), child] },
  }));
}

/** Whether `tree` already carries an `outlet` node anywhere. At most one is allowed. */
export function hasOutlet(tree: readonly RouteSectionNode[]): boolean {
  return tree.some(
    (node) =>
      node.sectionKey === OUTLET_SECTION_KEY ||
      Object.values(node.slots).some((children) => hasOutlet(children)),
  );
}

/** A fresh `outlet` marker node — where this route's matched child renders. */
export function newOutletNode(): RouteSectionNode {
  return {
    instanceId: crypto.randomUUID(),
    sectionKey: OUTLET_SECTION_KEY,
    content: {},
    slots: {},
  };
}

export function moveRoot(
  tree: readonly RouteSectionNode[],
  instanceId: string,
  delta: number,
): RouteSectionNode[] {
  const index = tree.findIndex((node) => node.instanceId === instanceId);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= tree.length) return [...tree];
  const next = [...tree];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
