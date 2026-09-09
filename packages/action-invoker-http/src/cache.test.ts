import { defineActions, InMemoryActionCacheStore } from "@feel-your-website/action-core";
import type { ActionInvoker, ActionResult } from "@feel-your-website/action-core";
import { describe, expect, it, vi } from "vitest";

import { CachingActionInvoker, cacheKey } from "./cache.js";

const catalog = defineActions([
  {
    id: "feed.releases",
    kind: "query",
    method: "GET",
    description: "Cached query.",
    input: [],
    allowedSources: ["static"],
    cache: { ttlMs: 1000, swr: true, negativeTtlMs: 500 },
  },
  {
    id: "plain.query",
    kind: "query",
    method: "GET",
    description: "Uncached query.",
    input: [],
    allowedSources: ["static"],
  },
  {
    id: "do.thing",
    kind: "mutation",
    method: "POST",
    description: "Mutation.",
    input: [],
    allowedSources: ["static"],
  },
]);

function stubInvoker(results: ActionResult[] | (() => ActionResult)): {
  invoker: ActionInvoker;
  calls: () => number;
} {
  let n = 0;
  const invoker: ActionInvoker = {
    invoke: () => {
      const result = Array.isArray(results) ? (results[n] ?? results.at(-1)!) : results();
      n += 1;
      return Promise.resolve(result);
    },
  };
  return { invoker, calls: () => n };
}

function make(inner: ActionInvoker, now: () => number) {
  return new CachingActionInvoker({ inner, catalog, store: new InMemoryActionCacheStore(), now });
}

describe("cacheKey", () => {
  it("is stable across object key order", () => {
    expect(cacheKey("a", { x: 1, y: 2 })).toBe(cacheKey("a", { y: 2, x: 1 }));
    expect(cacheKey("a", { x: 1 })).not.toBe(cacheKey("b", { x: 1 }));
  });
});

describe("CachingActionInvoker", () => {
  it("serves a fresh hit without calling the inner invoker again", async () => {
    let t = 0;
    const { invoker, calls } = stubInvoker([{ ok: true, data: { v: 1 } }]);
    const cached = make(invoker, () => t);

    expect(await cached.invoke("feed.releases", {}, {})).toEqual({ ok: true, data: { v: 1 } });
    t = 999;
    expect(await cached.invoke("feed.releases", {}, {})).toEqual({ ok: true, data: { v: 1 } });
    expect(calls()).toBe(1);
  });

  it("refetches once the entry is fully expired (no swr grace left)", async () => {
    let t = 0;
    const { invoker, calls } = stubInvoker([
      { ok: true, data: { v: 1 } },
      { ok: true, data: { v: 2 } },
    ]);
    const cached = make(invoker, () => t);

    await cached.invoke("feed.releases", {}, {});
    t = 3000; // past ttl (1000) + swr grace (1000)
    expect(await cached.invoke("feed.releases", {}, {})).toEqual({ ok: true, data: { v: 2 } });
    expect(calls()).toBe(2);
  });

  it("serves stale immediately and refreshes in the background within the swr window", async () => {
    let t = 0;
    const { invoker, calls } = stubInvoker([
      { ok: true, data: { v: 1 } },
      { ok: true, data: { v: 2 } },
    ]);
    const cached = make(invoker, () => t);

    await cached.invoke("feed.releases", {}, {});
    t = 1500; // past ttl, inside the swr grace (1000..2000)

    const stale = await cached.invoke("feed.releases", {}, {});
    expect(stale).toEqual({ ok: true, data: { v: 1 }, stale: true });

    await vi.waitFor(() => expect(calls()).toBe(2)); // background refresh landed
    expect(await cached.invoke("feed.releases", {}, {})).toEqual({ ok: true, data: { v: 2 } });
  });

  it("collapses a burst of identical misses into one upstream call", async () => {
    let n = 0;
    const invoker: ActionInvoker = {
      invoke: () =>
        new Promise((resolve) => {
          n += 1;
          setTimeout(() => resolve({ ok: true, data: { n } }), 5);
        }),
    };
    const cached = make(invoker, () => 0);

    const [a, b, c] = await Promise.all([
      cached.invoke("feed.releases", {}, {}),
      cached.invoke("feed.releases", {}, {}),
      cached.invoke("feed.releases", {}, {}),
    ]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(n).toBe(1);
  });

  it("negative-caches a failure for negativeTtlMs, then retries", async () => {
    let t = 0;
    const { invoker, calls } = stubInvoker([
      { ok: false, code: "unavailable" },
      { ok: true, data: { v: 1 } },
    ]);
    const cached = make(invoker, () => t);

    expect(await cached.invoke("feed.releases", {}, {})).toEqual({
      ok: false,
      code: "unavailable",
    });
    t = 400; // inside negativeTtlMs (500)
    expect(await cached.invoke("feed.releases", {}, {})).toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(calls()).toBe(1);

    t = 600; // past it
    expect(await cached.invoke("feed.releases", {}, {})).toEqual({ ok: true, data: { v: 1 } });
    expect(calls()).toBe(2);
  });

  it("passes a query with no cache config straight through", async () => {
    const { invoker, calls } = stubInvoker(() => ({ ok: true, data: {} }));
    const cached = make(invoker, () => 0);

    await cached.invoke("plain.query", {}, {});
    await cached.invoke("plain.query", {}, {});
    expect(calls()).toBe(2);
  });

  it("never caches a mutation", async () => {
    const { invoker, calls } = stubInvoker(() => ({ ok: true, data: {} }));
    const cached = make(invoker, () => 0);

    await cached.invoke("do.thing", {}, {});
    await cached.invoke("do.thing", {}, {});
    expect(calls()).toBe(2);
  });
});
