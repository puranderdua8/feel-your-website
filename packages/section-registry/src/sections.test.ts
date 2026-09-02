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
});
