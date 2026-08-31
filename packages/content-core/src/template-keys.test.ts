import { describe, expect, it } from "vitest";

import { defineTemplateKeys, findUnknownTemplateKeys } from "./template-keys.js";

const catalog = defineTemplateKeys([
  { name: "guidance", description: "Guidance copy shown before recording." },
  { name: "legal", description: "Terms and privacy copy." },
]);

describe("defineTemplateKeys", () => {
  it("exposes names in declaration order", () => {
    expect(catalog.values).toEqual(["guidance", "legal"]);
  });

  it("narrows unknown keys", () => {
    expect(catalog.includes("guidance")).toBe(true);
    expect(catalog.includes("announcements")).toBe(false);
  });

  it("throws on duplicates", () => {
    expect(() =>
      defineTemplateKeys([
        { name: "a", description: "one" },
        { name: "a", description: "two" },
      ]),
    ).toThrow(/Duplicate template key/);
  });
});

describe("findUnknownTemplateKeys", () => {
  it("returns nothing for a valid bundle", () => {
    expect(findUnknownTemplateKeys(catalog, ["guidance", "legal"])).toEqual([]);
  });

  it("reports every unknown key at once, not just the first", () => {
    // The CMS shows all bad keys in one go rather than making an author
    // discover them one failed save at a time.
    expect(findUnknownTemplateKeys(catalog, ["guidance", "nope", "also-nope"])).toEqual([
      "also-nope",
      "nope",
    ]);
  });

  it("deduplicates repeated unknown keys", () => {
    expect(findUnknownTemplateKeys(catalog, ["nope", "nope"])).toEqual(["nope"]);
  });

  it("treats an empty bundle as valid", () => {
    expect(findUnknownTemplateKeys(catalog, [])).toEqual([]);
  });
});
