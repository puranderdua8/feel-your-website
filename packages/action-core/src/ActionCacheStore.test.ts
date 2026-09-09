import { describe, expect, it } from "vitest";

import { InMemoryActionCacheStore, type CacheEntry } from "./ActionCacheStore.js";

function entry(value: unknown): CacheEntry {
  const now = Date.now();
  return { value, expiresAt: now + 1000, staleUntil: now + 2000 };
}

describe("InMemoryActionCacheStore", () => {
  it("misses an unknown key", () => {
    expect(new InMemoryActionCacheStore().get("nope")).toBeUndefined();
  });

  it("round-trips an entry by reference", () => {
    const store = new InMemoryActionCacheStore();
    const e = entry({ a: 1 });
    store.set("k", e);
    expect(store.get("k")).toBe(e);
  });

  it("overwrites and deletes", () => {
    const store = new InMemoryActionCacheStore();
    store.set("k", entry(1));
    store.set("k", entry(2));
    expect(store.get("k")?.value).toBe(2);

    store.delete("k");
    expect(store.get("k")).toBeUndefined();
  });

  it("keeps keys independent", () => {
    const store = new InMemoryActionCacheStore();
    store.set("a", entry("A"));
    store.set("b", entry("B"));
    expect(store.get("a")?.value).toBe("A");
    expect(store.get("b")?.value).toBe("B");
  });

  it("does not apply any freshness policy of its own", () => {
    const store = new InMemoryActionCacheStore();
    const stale: CacheEntry = { value: 1, expiresAt: 0, staleUntil: 0 };
    store.set("k", stale);
    // The store returns whatever it holds; the caller decides if it is usable.
    expect(store.get("k")).toBe(stale);
  });
});
