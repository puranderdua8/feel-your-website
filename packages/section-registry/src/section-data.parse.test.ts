import type { JsonValue } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { parseReleases, SECTION_QUERY_REGISTRY } from "./section-data.js";

const ok: JsonValue = [
  { title: "v2.0.0", url: "https://x.test/2.0.0", date: "2026-01-01" },
  { title: "v1.9.0", url: "https://x.test/1.9.0", date: "2025-12-01" },
];

describe("parseReleases", () => {
  it("accepts a bare array of {title,url,date} strings and passes it through untouched", () => {
    expect(parseReleases(ok)).toEqual(ok);
  });

  it("accepts an empty array", () => {
    expect(parseReleases([])).toEqual([]);
  });

  it.each<[string, JsonValue]>([
    ["not an array", { title: "v1", url: "u", date: "d" }],
    ["a string", "v1"],
    ["null", null],
    ["an entry missing url", [{ title: "v1", date: "d" }]],
    ["an entry with a non-string field", [{ title: "v1", url: "u", date: 20260101 }]],
    ["one bad entry among good ones", [ok[0]!, { title: "v1", url: "u" }]],
  ])("rejects %s with null", (_label, input) => {
    expect(parseReleases(input)).toBeNull();
  });

  it("returns the value as-is — extra keys on an entry are kept, not stripped", () => {
    const withExtra = [{ title: "v1", url: "u", date: "d", extra: 1 }];
    expect(parseReleases(withExtra as JsonValue)).toEqual(withExtra);
  });
});

describe("release-feed query spec", () => {
  const spec = SECTION_QUERY_REGISTRY["release-feed"]!;

  it("is registered", () => {
    expect(spec).toBeDefined();
  });

  it("derives feed.releases with the authored count, clamped to 1..20", () => {
    expect(spec.deriveInvocation({ count: 8 }, undefined)).toEqual({
      actionId: "feed.releases",
      body: { limit: 8 },
    });
    expect(spec.deriveInvocation({ count: 0 }, undefined)?.body).toEqual({ limit: 1 });
    expect(spec.deriveInvocation({ count: 999 }, undefined)?.body).toEqual({ limit: 20 });
    expect(spec.deriveInvocation({ count: 3.9 }, undefined)?.body).toEqual({ limit: 3 });
  });

  it("falls back to 5 when count is absent or not a finite number", () => {
    expect(spec.deriveInvocation({}, undefined)?.body).toEqual({ limit: 5 });
    expect(spec.deriveInvocation({ count: "lots" }, undefined)?.body).toEqual({ limit: 5 });
  });

  it("ships a previewSample its own project accepts", () => {
    expect(spec.previewSample).toBeDefined();
    expect(spec.project?.(spec.previewSample as JsonValue)).toEqual(spec.previewSample);
  });
});
