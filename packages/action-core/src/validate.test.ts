import { describe, expect, it } from "vitest";

import type { MutationActionDefinition } from "./types.js";
import { parseActionInputMapping, validateActionBinding, validateActionInput } from "./validate.js";

const subscribe: MutationActionDefinition = {
  id: "newsletter.subscribe",
  kind: "mutation",
  method: "POST",
  description: "Subscribe.",
  input: [
    { name: "email", label: "Email", type: "text", required: true },
    { name: "tag", label: "Tag", type: "text" },
    { name: "count", label: "Count", type: "number" },
  ],
  allowedSources: ["static", "routeParam"],
};

describe("validateActionInput", () => {
  it("passes a well-formed body", () => {
    expect(validateActionInput(subscribe, { email: "a@b.c", count: 2 })).toEqual([]);
  });

  it("flags a missing required input", () => {
    expect(validateActionInput(subscribe, { email: "  " })).toEqual([
      { field: "email", message: "Email is required." },
    ]);
  });

  it("type-checks a number input", () => {
    const issues = validateActionInput(subscribe, { email: "a@b.c", count: "two" });
    expect(issues.map((i) => i.field)).toEqual(["count"]);
  });
});

describe("validateActionBinding", () => {
  const ctx = { routeParamNames: ["slug"] };

  it("passes a valid mapping", () => {
    const issues = validateActionBinding(
      subscribe,
      {
        email: { source: "routeParam", value: "slug" },
        tag: { source: "static", value: "newsletter" },
      },
      ctx,
    );
    expect(issues).toEqual([]);
  });

  it("flags a required input that is not mapped", () => {
    const issues = validateActionBinding(subscribe, {}, ctx);
    expect(issues).toEqual([{ field: "email", message: "Email is required but not mapped." }]);
  });

  it("flags a mapped name that is not an input", () => {
    const issues = validateActionBinding(
      subscribe,
      {
        email: { source: "static", value: "x" },
        bogus: { source: "static", value: "x" },
      },
      ctx,
    );
    expect(issues).toEqual([
      { field: "bogus", message: '"bogus" is not an input of this action.' },
    ]);
  });

  it("flags a disallowed source", () => {
    const issues = validateActionBinding(
      subscribe,
      { email: { source: "formInput", value: "email" } },
      ctx,
    );
    expect(issues[0]?.field).toBe("email");
    expect(issues[0]?.message).toMatch(/may not be filled from formInput/);
  });

  it("flags an empty value", () => {
    const issues = validateActionBinding(
      subscribe,
      { email: { source: "static", value: "   " } },
      ctx,
    );
    expect(issues).toEqual([{ field: "email", message: "Email has no value." }]);
  });

  it("flags a routeParam that the route does not have", () => {
    const issues = validateActionBinding(
      subscribe,
      { email: { source: "routeParam", value: "id" } },
      ctx,
    );
    expect(issues[0]?.message).toMatch(/route has no param for/);
  });

  const formSubscribe: MutationActionDefinition = {
    ...subscribe,
    allowedSources: ["static", "routeParam", "formInput"],
  };

  it("passes a formInput that names a known form field", () => {
    const issues = validateActionBinding(
      formSubscribe,
      { email: { source: "formInput", value: "email" } },
      { routeParamNames: [], formInputNames: ["email", "name"] },
    );
    expect(issues).toEqual([]);
  });

  it("flags a formInput that names no form field", () => {
    const issues = validateActionBinding(
      formSubscribe,
      { email: { source: "formInput", value: "e_mail" } },
      { routeParamNames: [], formInputNames: ["email"] },
    );
    expect(issues[0]?.field).toBe("email");
    expect(issues[0]?.message).toMatch(/form has no field for/);
  });

  it("skips the form-field check when formInputNames is omitted (the shell path)", () => {
    const issues = validateActionBinding(
      formSubscribe,
      { email: { source: "formInput", value: "anything" } },
      { routeParamNames: [] },
    );
    expect(issues).toEqual([]);
  });
});

describe("parseActionInputMapping", () => {
  it("parses a JSON-string mapping", () => {
    const raw = JSON.stringify({ email: { source: "routeParam", value: "slug" } });
    expect(parseActionInputMapping(raw)).toEqual({
      email: { source: "routeParam", value: "slug" },
    });
  });

  it("accepts an already-parsed object", () => {
    expect(parseActionInputMapping({ a: { source: "static", value: "1" } })).toEqual({
      a: { source: "static", value: "1" },
    });
  });

  it("treats an empty or whitespace string as an empty mapping", () => {
    expect(parseActionInputMapping("")).toEqual({});
    expect(parseActionInputMapping("   ")).toEqual({});
  });

  it("returns null for malformed JSON", () => {
    expect(parseActionInputMapping("{ not json")).toBeNull();
  });

  it("returns null for a non-object top level", () => {
    expect(parseActionInputMapping("[1,2]")).toBeNull();
    expect(parseActionInputMapping("42")).toBeNull();
    expect(parseActionInputMapping(null)).toBeNull();
  });

  it("returns null when an entry is not a {source,value} record", () => {
    expect(parseActionInputMapping(JSON.stringify({ a: "x" }))).toBeNull();
    expect(parseActionInputMapping(JSON.stringify({ a: { source: "static" } }))).toBeNull();
    expect(
      parseActionInputMapping(JSON.stringify({ a: { source: "nope", value: "x" } })),
    ).toBeNull();
    expect(
      parseActionInputMapping(JSON.stringify({ a: { source: "static", value: 1 } })),
    ).toBeNull();
  });
});
