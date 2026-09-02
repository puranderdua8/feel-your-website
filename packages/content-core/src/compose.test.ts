import { describe, expect, it } from "vitest";

import { assembleSectionTree, flattenNodes, flattenTree, type FlatSectionRow } from "./compose.js";
import type { RouteSectionNode } from "./types.js";

const row = (
  over: Partial<FlatSectionRow> & Pick<FlatSectionRow, "instanceId">,
): FlatSectionRow => ({
  parentInstanceId: null,
  parentSlot: null,
  ordinal: 0,
  sectionKey: "hero",
  ...over,
});

const node = (
  over: Partial<RouteSectionNode> & Pick<RouteSectionNode, "instanceId" | "sectionKey">,
): RouteSectionNode => ({ content: {}, slots: {}, ...over });

describe("assembleSectionTree", () => {
  it("returns an empty array for no rows", () => {
    expect(assembleSectionTree([])).toEqual([]);
  });

  it("orders roots by ordinal, not row order", () => {
    const tree = assembleSectionTree([
      row({ instanceId: "b", ordinal: 1, sectionKey: "footer" }),
      row({ instanceId: "a", ordinal: 0, sectionKey: "hero" }),
    ]);

    expect(tree.map((n) => n.instanceId)).toEqual(["a", "b"]);
    expect(tree.map((n) => n.sectionKey)).toEqual(["hero", "footer"]);
  });

  it("folds each row's per-locale content onto its node, defaulting to {}", () => {
    const tree = assembleSectionTree([
      row({ instanceId: "a", content: { en: { title: "Hi" }, hi: { title: "नमस्ते" } } }),
      row({ instanceId: "b", ordinal: 1 }),
    ]);

    expect(tree[0]!.content).toEqual({ en: { title: "Hi" }, hi: { title: "नमस्ते" } });
    expect(tree[1]!.content).toEqual({});
  });

  it("nests children under the right slot, ordered within the slot", () => {
    const tree = assembleSectionTree([
      row({ instanceId: "card", sectionKey: "card" }),
      row({
        instanceId: "ic",
        parentInstanceId: "card",
        parentSlot: "icon",
        sectionKey: "icon",
      }),
      row({
        instanceId: "b1",
        parentInstanceId: "card",
        parentSlot: "body",
        ordinal: 1,
        sectionKey: "text",
      }),
      row({
        instanceId: "b0",
        parentInstanceId: "card",
        parentSlot: "body",
        ordinal: 0,
        sectionKey: "text",
      }),
    ]);

    expect(tree).toHaveLength(1);
    const card = tree[0]!;
    expect(card.slots.icon?.map((n) => n.sectionKey)).toEqual(["icon"]);
    expect(card.slots.body?.map((n) => n.instanceId)).toEqual(["b0", "b1"]);
  });

  it("drops an orphan row whose parent is not in the set", () => {
    const tree = assembleSectionTree([
      row({ instanceId: "ghost", parentInstanceId: "missing", parentSlot: "body" }),
    ]);

    expect(tree).toEqual([]);
  });

  it("terminates on a cyclic row set instead of recursing forever", () => {
    const tree = assembleSectionTree([
      row({ instanceId: "a", parentInstanceId: "b", parentSlot: "body" }),
      row({ instanceId: "b", parentInstanceId: "a", parentSlot: "body" }),
    ]);

    // Neither is a real root, so nothing renders — the point is it returns.
    expect(Array.isArray(tree)).toBe(true);
  });
});

describe("flattenTree", () => {
  it("is a pre-order walk of the section keys present", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        sectionKey: "card",
        slots: {
          icon: [node({ instanceId: "ic", sectionKey: "icon" })],
          body: [node({ instanceId: "t", sectionKey: "text" })],
        },
      }),
      node({ instanceId: "f", sectionKey: "footer" }),
    ];

    expect(flattenTree(tree)).toEqual(["card", "icon", "text", "footer"]);
  });

  it("round-trips through assembleSectionTree", () => {
    const rows = [
      row({ instanceId: "card", sectionKey: "card" }),
      row({ instanceId: "ic", parentInstanceId: "card", parentSlot: "icon", sectionKey: "icon" }),
    ];

    expect(flattenTree(assembleSectionTree(rows))).toEqual(["card", "icon"]);
  });
});

describe("flattenNodes", () => {
  it("is a pre-order walk of every node instance, slots included", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        sectionKey: "card",
        slots: { body: [node({ instanceId: "t", sectionKey: "text" })] },
      }),
      node({ instanceId: "f", sectionKey: "footer" }),
    ];

    expect(flattenNodes(tree).map((n) => n.instanceId)).toEqual(["card", "t", "f"]);
  });
});
