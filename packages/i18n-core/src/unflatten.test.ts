import { describe, expect, it } from "vitest";

import { unflattenMessages } from "./bootstrap.js";

/**
 * The CMS stores messages as flat rows; the formatter treats dots as
 * namespaces. This function is the only place those two shapes meet, so it is
 * worth testing on its own rather than only through the provider.
 */
describe("unflattenMessages", () => {
  it("nests dotted keys", () => {
    expect(unflattenMessages({ "a.b.c": "x" })).toEqual({ a: { b: { c: "x" } } });
  });

  it("leaves undotted keys alone", () => {
    expect(unflattenMessages({ hello: "x" })).toEqual({ hello: "x" });
  });

  it("merges siblings under a shared namespace", () => {
    expect(unflattenMessages({ "app.title": "T", "app.body": "B", other: "O" })).toEqual({
      app: { title: "T", body: "B" },
      other: "O",
    });
  });

  it("keeps children reachable when a key is both leaf and branch", () => {
    // `a` cannot be a string and a namespace at once. Dropping the string is
    // the choice that keeps `a.b` addressable; the reverse would silently
    // orphan every child.
    expect(unflattenMessages({ a: "leaf", "a.b": "child" })).toEqual({
      a: { b: "child" },
    });
  });

  it("is order-independent", () => {
    const forward = unflattenMessages({ a: "leaf", "a.b": "child" });
    const reverse = unflattenMessages({ "a.b": "child", a: "leaf" });
    expect(forward).toEqual(reverse);
  });

  it("handles an empty map", () => {
    expect(unflattenMessages({})).toEqual({});
  });

  it("preserves ICU syntax verbatim", () => {
    const icu = "{count, plural, one {# clip} other {# clips}}";
    expect(unflattenMessages({ "session.clips": icu })).toEqual({
      session: { clips: icu },
    });
  });
});
