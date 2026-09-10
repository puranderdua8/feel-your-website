import { describe, expect, it } from "vitest";

import { InMemoryActionCacheStore, type CacheEntry } from "./ActionCacheStore.js";

function entry(value: unknown): CacheEntry {
  const now = Date.now();
  return { value, expiresAt: now + 1000, staleUntil: now + 2000 };
}

describe("InMemoryActionCacheStore", () => {
  it("misses an unknown key", async () => {
    expect(await new InMemoryActionCacheStore().get("nope")).toBeUndefined();
  });

  it("round-trips an entry by reference", async () => {
    const store = new InMemoryActionCacheStore();
    const e = entry({ a: 1 });
    await store.set("k", e);
    expect(await store.get("k")).toBe(e);
  });

  it("overwrites and deletes", async () => {
    const store = new InMemoryActionCacheStore();
    await store.set("k", entry(1));
    await store.set("k", entry(2));
    expect((await store.get("k"))?.value).toBe(2);

    await store.delete("k");
    expect(await store.get("k")).toBeUndefined();
  });

  it("keeps keys independent", async () => {
    const store = new InMemoryActionCacheStore();
    await store.set("a", entry("A"));
    await store.set("b", entry("B"));
    expect((await store.get("a"))?.value).toBe("A");
    expect((await store.get("b"))?.value).toBe("B");
  });

  it("does not apply any freshness policy of its own", async () => {
    const store = new InMemoryActionCacheStore();
    const stale: CacheEntry = { value: 1, expiresAt: 0, staleUntil: 0 };
    await store.set("k", stale);
    // The store returns whatever it holds; the caller decides if it is usable.
    expect(await store.get("k")).toBe(stale);
  });
});
