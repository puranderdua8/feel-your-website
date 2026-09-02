import { describe, expect, it } from "vitest";

import {
  assembleSectionTree,
  collectEffectiveRefs,
  flattenTree,
  type FlatSectionRow,
} from "./compose.js";
import { defineSections } from "./section-schema.js";
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

describe("assembleSectionTree", () => {
  it("returns an empty array for no rows", () => {
    expect(assembleSectionTree([])).toEqual([]);
  });

  it("orders roots by ordinal, not row order", () => {
    const tree = assembleSectionTree([
      row({ instanceId: "b", ordinal: 1, sectionKey: "footer" }),
      row({ instanceId: "a", ordinal: 0, sectionKey: "hero" }),
    ]);

    expect(tree.map((node) => node.instanceId)).toEqual(["a", "b"]);
    expect(tree.map((node) => node.ref.key)).toEqual(["hero", "footer"]);
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
  it("is a pre-order walk of the refs present, defaults excluded", () => {
    const tree: RouteSectionNode[] = [
      {
        instanceId: "card",
        ref: { key: "card", variant: "" },
        slots: {
          icon: [{ instanceId: "ic", ref: { key: "icon", variant: "star" }, slots: {} }],
          body: [{ instanceId: "t", ref: { key: "text", variant: "" }, slots: {} }],
        },
      },
      { instanceId: "f", ref: { key: "footer", variant: "" }, slots: {} },
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

describe("collectEffectiveRefs", () => {
  const catalog = defineSections([
    { key: "icon", description: "", fields: [], slots: [] },
    { key: "text", description: "", fields: [], slots: [] },
    {
      key: "card",
      description: "",
      fields: [],
      slots: [
        {
          name: "icon",
          label: "Icon",
          accepts: ["icon"],
          arity: "single",
          required: true,
          default: { key: "icon", variant: "" },
        },
        { name: "body", label: "Body", accepts: ["text"], arity: "list" },
      ],
    },
  ]);

  it("includes a required empty slot's default ref", () => {
    const tree: RouteSectionNode[] = [
      { instanceId: "card", ref: { key: "card", variant: "" }, slots: {} },
    ];

    expect(collectEffectiveRefs(catalog, tree)).toEqual([
      { key: "card", variant: "" },
      { key: "icon", variant: "" },
    ]);
  });

  it("uses the filling ref, not the default, when the slot is filled", () => {
    const tree: RouteSectionNode[] = [
      {
        instanceId: "card",
        ref: { key: "card", variant: "" },
        slots: { icon: [{ instanceId: "ic", ref: { key: "icon", variant: "star" }, slots: {} }] },
      },
    ];

    expect(collectEffectiveRefs(catalog, tree)).toEqual([
      { key: "card", variant: "" },
      { key: "icon", variant: "star" },
    ]);
  });

  it("de-duplicates a ref reached twice", () => {
    const tree: RouteSectionNode[] = [
      { instanceId: "c1", ref: { key: "card", variant: "" }, slots: {} },
      { instanceId: "c2", ref: { key: "card", variant: "" }, slots: {} },
    ];

    expect(collectEffectiveRefs(catalog, tree)).toEqual([
      { key: "card", variant: "" },
      { key: "icon", variant: "" },
    ]);
  });
});
