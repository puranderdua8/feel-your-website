import { describe, expect, it } from "vitest";

import {
  defineSections,
  findUnknownSectionKeys,
  validateSectionFields,
  type SectionDefinition,
} from "./section-schema.js";

const card: SectionDefinition = {
  key: "card",
  description: "A card.",
  fields: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "count", label: "Count", type: "number" },
    { name: "featured", label: "Featured", type: "boolean" },
    { name: "tone", label: "Tone", type: "select", options: ["info", "warn"] },
  ],
  slots: [{ name: "icon", label: "Icon", accepts: ["icon"], arity: "single" }],
};

describe("defineSections", () => {
  it("indexes by key and reports membership", () => {
    const catalog = defineSections([card]);
    expect(catalog.values).toEqual(["card"]);
    expect(catalog.byKey.get("card")).toBe(card);
    expect(catalog.includes("card")).toBe(true);
    expect(catalog.includes("nope")).toBe(false);
  });

  it("throws on a duplicate key", () => {
    expect(() => defineSections([card, { ...card }])).toThrow(/Duplicate section key/);
  });
});

describe("validateSectionFields", () => {
  it("passes a well-formed payload", () => {
    expect(
      validateSectionFields(card, { title: "Hi", count: 3, featured: true, tone: "info" }),
    ).toEqual([]);
  });

  it("flags a missing required field", () => {
    const issues = validateSectionFields(card, { title: "  " });
    expect(issues).toEqual([{ field: "title", message: "Title is required." }]);
  });

  it("skips type checks for an absent optional field", () => {
    expect(validateSectionFields(card, { title: "Hi" })).toEqual([]);
  });

  it("type-checks number, boolean and select when present", () => {
    const issues = validateSectionFields(card, {
      title: "Hi",
      count: "three",
      featured: "yes",
      tone: "loud",
    });
    expect(issues.map((i) => i.field)).toEqual(["count", "featured", "tone"]);
  });
});

describe("findUnknownSectionKeys", () => {
  it("returns only the keys not in the catalog, de-duplicated and sorted", () => {
    const catalog = defineSections([card]);
    const unknown = findUnknownSectionKeys(catalog, ["card", "ghost", "phantom", "ghost"]);
    expect(unknown).toEqual(["ghost", "phantom"]);
  });
});
