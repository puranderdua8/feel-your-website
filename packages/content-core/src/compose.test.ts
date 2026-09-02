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
  sectionVariant: "",
  ...over,
});

const node = (
  over: Partial<RouteSectionNode> & Pick<RouteSectionNode, "instanceId" | "ref">,
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
    expect(tree.map((n) => n.ref.key)).toEqual(["hero", "footer"]);
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
        sectionVariant: "star",
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
    expect(card.slots.icon?.map((n) => n.ref)).toEqual([{ key: "icon", variant: "star" }]);
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
  it("is a pre-order walk of the refs present", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        ref: { key: "card", variant: "" },
        slots: {
          icon: [node({ instanceId: "ic", ref: { key: "icon", variant: "star" } })],
          body: [node({ instanceId: "t", ref: { key: "text", variant: "" } })],
        },
      }),
      node({ instanceId: "f", ref: { key: "footer", variant: "" } }),
    ];

    expect(flattenTree(tree)).toEqual([
      { key: "card", variant: "" },
      { key: "icon", variant: "star" },
      { key: "text", variant: "" },
      { key: "footer", variant: "" },
    ]);
  });

  it("round-trips through assembleSectionTree", () => {
    const rows = [
      row({ instanceId: "card", sectionKey: "card" }),
      row({ instanceId: "ic", parentInstanceId: "card", parentSlot: "icon", sectionKey: "icon" }),
    ];

    expect(flattenTree(assembleSectionTree(rows)).map((r) => r.key)).toEqual(["card", "icon"]);
  });
});

describe("flattenNodes", () => {
  it("is a pre-order walk of every node instance, slots included", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        ref: { key: "card", variant: "" },
        slots: { body: [node({ instanceId: "t", ref: { key: "text", variant: "" } })] },
      }),
      node({ instanceId: "f", ref: { key: "footer", variant: "" } }),
    ];

    expect(flattenNodes(tree).map((n) => n.instanceId)).toEqual(["card", "t", "f"]);
  });
});
