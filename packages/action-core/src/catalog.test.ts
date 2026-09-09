import { describe, expect, it } from "vitest";

import { defineActions, findUnknownActionIds } from "./catalog.js";
import type { MutationActionDefinition, QueryActionDefinition } from "./types.js";

const feed: QueryActionDefinition = {
  id: "feed.releases",
  kind: "query",
  method: "GET",
  description: "Releases.",
  input: [{ name: "limit", label: "Limit", type: "number" }],
  allowedSources: ["static", "routeParam"],
  cache: { ttlMs: 60_000 },
};

const subscribe: MutationActionDefinition = {
  id: "newsletter.subscribe",
  kind: "mutation",
  method: "POST",
  description: "Subscribe.",
  input: [{ name: "email", label: "Email", type: "text", required: true }],
  allowedSources: ["static", "routeParam"],
};

describe("defineActions", () => {
  it("indexes by id and reports membership", () => {
    const catalog = defineActions([feed, subscribe]);
    expect(catalog.values).toEqual(["feed.releases", "newsletter.subscribe"]);
    expect(catalog.byId.get("feed.releases")).toBe(feed);
    expect(catalog.includes("newsletter.subscribe")).toBe(true);
    expect(catalog.includes("nope")).toBe(false);
  });

  it("throws on a duplicate id", () => {
    expect(() => defineActions([feed, { ...feed }])).toThrow(/Duplicate action id/);
  });

  it("throws when a query has an unsafe method", () => {
    const bad = { ...feed, method: "POST" } as unknown as QueryActionDefinition;
    expect(() => defineActions([bad])).toThrow(/query but its method is POST/);
  });

  it("throws when a mutation has a safe method", () => {
    const bad = { ...subscribe, method: "GET" } as unknown as MutationActionDefinition;
    expect(() => defineActions([bad])).toThrow(/mutation but its method is GET/);
  });

  it("throws when a mutation declares a cache", () => {
    const bad = { ...subscribe, cache: { ttlMs: 1 } } as unknown as MutationActionDefinition;
    expect(() => defineActions([bad])).toThrow(/mutation and cannot declare a cache/);
  });

  it("throws when a query declares idempotent or confirm", () => {
    const bad = { ...feed, confirm: true } as unknown as QueryActionDefinition;
    expect(() => defineActions([bad])).toThrow(/query and cannot declare "confirm"/);
  });
});

describe("findUnknownActionIds", () => {
  it("returns only the ids not in the catalog, de-duplicated and sorted", () => {
    const catalog = defineActions([feed, subscribe]);
    expect(findUnknownActionIds(catalog, ["feed.releases", "ghost", "phantom", "ghost"])).toEqual([
      "ghost",
      "phantom",
    ]);
    expect(findUnknownActionIds(catalog, ["feed.releases"])).toEqual([]);
  });
});
