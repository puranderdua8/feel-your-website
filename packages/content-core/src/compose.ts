import type { JsonValue, Locale, RouteSectionNode } from "./types.js";

/**
 * Route-composition helpers, shared by both adapters and the CMS.
 *
 * The tree is assembled in TypeScript from flat rows — never a recursive SQL
 * CTE — so `content-adapter-memory` and `content-adapter-supabase` build it
 * with exactly the same code and cannot drift. This module holds that code.
 */

/**
 * The flat row every adapter maps its storage into before calling
 * {@link assembleSectionTree}: one row per instance, parent named by id +
 * slot, ordered within its sibling group by `ordinal`, and the instance's own
 * per-locale content folded in.
 */
export interface FlatSectionRow {
  readonly instanceId: string;
  /** `null` for a page-level root. */
  readonly parentInstanceId: string | null;
  /** The parent slot this instance fills. `null` iff `parentInstanceId` is null. */
  readonly parentSlot: string | null;
  /** Order within `(parentInstanceId, parentSlot)`. */
  readonly ordinal: number;
  readonly sectionKey: string;
  /**
   * This instance's content, `locale -> field bag`. Omitted is treated as
   * `{}` — an instance with no content rows yet.
   */
  readonly content?: Readonly<Record<Locale, Readonly<Record<string, JsonValue>>>>;
}

/**
 * Builds the route's {@link RouteSectionNode} tree from flat rows.
 *
 * Groups by `parentInstanceId` (`null` = roots), then by `parentSlot`, sorts
 * each group by `ordinal`, and recurses. A row whose `parentInstanceId` names
 * an instance not present in `rows` is dropped (it can only be an orphan from
 * a partial read); a row already reached once is not visited again, so a
 * malformed cyclic row set terminates instead of hanging.
 */
export function assembleSectionTree(rows: readonly FlatSectionRow[]): readonly RouteSectionNode[] {
  const childrenOf = new Map<string | null, FlatSectionRow[]>();
  for (const row of rows) {
    const group = childrenOf.get(row.parentInstanceId);
    if (group) group.push(row);
    else childrenOf.set(row.parentInstanceId, [row]);
  }

  const known = new Set(rows.map((row) => row.instanceId));
  const seen = new Set<string>();

  const build = (row: FlatSectionRow): RouteSectionNode => {
    seen.add(row.instanceId);
    const kids = [...(childrenOf.get(row.instanceId) ?? [])].sort((a, b) => a.ordinal - b.ordinal);

    const slots: Record<string, RouteSectionNode[]> = {};
    for (const kid of kids) {
      if (seen.has(kid.instanceId)) continue;
      const slotName = kid.parentSlot ?? "";
      (slots[slotName] ??= []).push(build(kid));
    }

    return {
      instanceId: row.instanceId,
      sectionKey: row.sectionKey,
      content: row.content ?? {},
      slots,
    };
  };

  return [...(childrenOf.get(null) ?? [])]
    .filter((row) => !row.parentInstanceId || known.has(row.parentInstanceId))
    .sort((a, b) => a.ordinal - b.ordinal)
    .map(build);
}

/** Depth-first walk yielding every node, parents before children. */
function* walk(tree: readonly RouteSectionNode[]): Generator<RouteSectionNode> {
  for (const node of tree) {
    yield node;
    for (const slotNodes of Object.values(node.slots)) yield* walk(slotNodes);
  }
}

/**
 * Pre-order list of the section keys present in the tree. This is what
 * derives the audit `items` list a route write records.
 */
export function flattenTree(tree: readonly RouteSectionNode[]): readonly string[] {
  return [...walk(tree)].map((node) => node.sectionKey);
}

/**
 * Pre-order list of every node instance in the tree — what the CMS
 * publish-completeness gate iterates, checking each instance's `content`
 * against its section schema for every configured site locale.
 */
export function flattenNodes(tree: readonly RouteSectionNode[]): readonly RouteSectionNode[] {
  return [...walk(tree)];
}
