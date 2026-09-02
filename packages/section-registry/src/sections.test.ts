import { validateSectionFields } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { sectionCatalog } from "./sections.js";

describe("sectionCatalog", () => {
  it("loads without a duplicate key and includes the composite and its atoms", () => {
    expect(sectionCatalog.includes("card")).toBe(true);
    expect(sectionCatalog.includes("icon")).toBe(true);
  });

  it("every slot's `accepts` names sections that exist in the catalog", () => {
    for (const def of sectionCatalog.definitions) {
      for (const slot of def.slots) {
        for (const accepted of slot.accepts) {
          expect(
            sectionCatalog.includes(accepted),
            `${def.key}.${slot.name} accepts ${accepted}`,
          ).toBe(true);
        }
      }
    }
  });

  it("its field schemas drive validateSectionFields", () => {
    const hero = sectionCatalog.byKey.get("hero")!;
    expect(validateSectionFields(hero, { title: "" })).toEqual([
      { field: "title", message: "Title is required." },
    ]);
    expect(validateSectionFields(hero, { title: "Welcome" })).toEqual([]);
  });

  it("every section ships sample content that satisfies its own required fields", () => {
    for (const def of sectionCatalog.definitions) {
      expect(def.sample, `${def.key} has no sample`).toBeDefined();
      expect(validateSectionFields(def, def.sample!.fields), `${def.key} sample fields`).toEqual(
        [],
      );
    }
  });

  it("sample slot children name sections the slot accepts and fill their required fields", () => {
    for (const def of sectionCatalog.definitions) {
      for (const [slotName, children] of Object.entries(def.sample?.slots ?? {})) {
        const slot = def.slots.find((s) => s.name === slotName);
        expect(slot, `${def.key} sample fills unknown slot ${slotName}`).toBeDefined();
        for (const child of children) {
          const childDef = sectionCatalog.byKey.get(child.sectionKey);
          expect(childDef, `${def.key}.${slotName} sample child ${child.sectionKey}`).toBeDefined();
          if (slot!.accepts.length > 0) {
            expect(slot!.accepts).toContain(child.sectionKey);
          }
          expect(
            validateSectionFields(childDef!, child.fields),
            `${def.key}.${slotName} sample child ${child.sectionKey} fields`,
          ).toEqual([]);
        }
      }
    }
  });
});
