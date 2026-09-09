import { describe, expect, it } from "vitest";

import { MemoryActionInvoker } from "./MemoryActionInvoker.js";

describe("MemoryActionInvoker", () => {
  it("returns seeded data for a known id", async () => {
    const invoker = new MemoryActionInvoker({ seed: { "x.y": { a: 1 } } });
    await expect(invoker.invoke("x.y", {})).resolves.toEqual({ ok: true, data: { a: 1 } });
  });

  it("calls a seed function with the request body", async () => {
    const invoker = new MemoryActionInvoker({
      seed: { "x.y": (body) => ({ preview: true, body }) },
    });
    await expect(invoker.invoke("x.y", { email: "a@b.c" })).resolves.toEqual({
      ok: true,
      data: { preview: true, body: { email: "a@b.c" } },
    });
  });

  it("is not_found for an unseeded id by default", async () => {
    const invoker = new MemoryActionInvoker({ seed: { "x.y": 1 } });
    await expect(invoker.invoke("other", {})).resolves.toEqual({ ok: false, code: "not_found" });
  });

  it("echoes the body for an unseeded id when echoUnseeded is on", async () => {
    const invoker = new MemoryActionInvoker({ echoUnseeded: true });
    await expect(invoker.invoke("anything", { n: 2 })).resolves.toEqual({
      ok: true,
      data: { n: 2 },
    });
  });

  it("fails every call with failWith, before any seed lookup", async () => {
    const invoker = new MemoryActionInvoker({
      seed: { "x.y": 1 },
      echoUnseeded: true,
      failWith: "timeout",
    });
    await expect(invoker.invoke("x.y", {})).resolves.toEqual({ ok: false, code: "timeout" });
  });
});
