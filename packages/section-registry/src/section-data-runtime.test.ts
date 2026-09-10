import type { JsonValue, RouteSectionNode } from "@feel-your-website/content-core";
import { describe, expect, it, vi } from "vitest";

import {
  collectInvocations,
  derivePreviewSectionData,
  planInvocations,
  runQueries,
  type CollectedInvocation,
  type QueryInvoker,
} from "./section-data-runtime.js";
import type { SectionQuerySpec } from "./section-data.js";

const feedSpec: SectionQuerySpec = {
  deriveInvocation: (fields) =>
    typeof fields.source === "string"
      ? { actionId: fields.source, body: { limit: fields.limit ?? 5 } }
      : null,
  project: (result) => (Array.isArray(result) ? result.slice(0, 2) : null),
};

const registry = { "release-feed": feedSpec };

const node = (
  instanceId: string,
  sectionKey: string,
  fields: Record<string, JsonValue> = {},
  slots: Record<string, RouteSectionNode[]> = {},
): RouteSectionNode =>
  ({ instanceId, sectionKey, content: { en: fields }, slots }) as RouteSectionNode;

describe("collectInvocations", () => {
  it("finds specced sections across layers and slots, skipping the rest", () => {
    const trees = [
      [node("a", "release-feed", { source: "feed.releases", limit: 3 }), node("x", "hero")],
      [node("c", "card", {}, { body: [node("b", "release-feed", { source: "feed.releases" })] })],
    ];

    const collected = collectInvocations(trees, "en", undefined, registry);
    expect(collected.map((c) => c.instanceId)).toEqual(["a", "b"]);
    expect(collected[0]?.invocation).toEqual({ actionId: "feed.releases", body: { limit: 3 } });
    expect(collected[0]?.blocking).toBe(true);
  });

  it("skips a section whose deriveInvocation returns null", () => {
    const trees = [[node("a", "release-feed", {})]]; // no `source`
    expect(collectInvocations(trees, "en", undefined, registry)).toEqual([]);
  });
});

describe("planInvocations", () => {
  const c = (
    instanceId: string,
    actionId: string,
    body: Record<string, JsonValue>,
  ): CollectedInvocation => ({
    instanceId,
    sectionKey: "release-feed",
    invocation: { actionId, body },
    blocking: true,
  });

  it("collapses identical invocations regardless of body key order", () => {
    const plan = planInvocations([
      c("a", "feed.releases", { limit: 5, tag: "x" }),
      c("b", "feed.releases", { tag: "x", limit: 5 }),
      c("d", "feed.releases", { limit: 9 }),
    ]);

    expect(plan.unique).toHaveLength(2);
    expect(plan.byInstance.get("a")).toBe(0);
    expect(plan.byInstance.get("b")).toBe(0);
    expect(plan.byInstance.get("d")).toBe(1);
  });
});

function invokerReturning(map: Record<string, Awaited<ReturnType<QueryInvoker["invoke"]>>>): {
  invoker: QueryInvoker;
  calls: () => number;
} {
  let calls = 0;
  return {
    calls: () => calls,
    invoker: {
      invoke: (actionId) => {
        calls += 1;
        return Promise.resolve(map[actionId] ?? { ok: false, code: "not_found" });
      },
    },
  };
}

describe("runQueries", () => {
  const plan = (instanceIds: string[], body: Record<string, JsonValue> = {}) =>
    planInvocations(
      instanceIds.map((id) => ({
        instanceId: id,
        sectionKey: "release-feed",
        invocation: { actionId: "feed.releases", body },
        blocking: true,
      })),
    );

  it("parses, projects and returns an entry per instance", async () => {
    const { invoker } = invokerReturning({
      "feed.releases": { ok: true, data: [1, 2, 3, 4] },
    });
    const out = await runQueries(plan(["a"]), invoker, { registry });
    expect(out).toEqual({ a: { ok: true, data: [1, 2] } });
  });

  it("de-duplicates: one call, shared result", async () => {
    const { invoker, calls } = invokerReturning({
      "feed.releases": { ok: true, data: [7] },
    });
    const out = await runQueries(plan(["a", "b"]), invoker, { registry });
    expect(calls()).toBe(1);
    expect(out.a).toEqual({ ok: true, data: [7] });
    expect(out.b).toEqual({ ok: true, data: [7] });
  });

  it("maps an ok:false result to an error entry", async () => {
    const { invoker } = invokerReturning({
      "feed.releases": { ok: false, code: "rate_limited" },
    });
    const out = await runQueries(plan(["a"]), invoker, { registry });
    expect(out.a).toEqual({ ok: false, error: { code: "rate_limited" } });
  });

  it("maps a rejected call to unavailable", async () => {
    const invoker: QueryInvoker = { invoke: () => Promise.reject(new Error("boom")) };
    const out = await runQueries(plan(["a"]), invoker, { registry });
    expect(out.a).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("rejects a payload parseResult returns null for", async () => {
    const { invoker } = invokerReturning({ "feed.releases": { ok: true, data: [1] } });
    const out = await runQueries(plan(["a"]), invoker, {
      registry,
      parseResult: () => null,
    });
    expect(out.a).toEqual({ ok: false, error: { code: "invalid_response" } });
  });

  it("rejects a payload the section's project rejects", async () => {
    const { invoker } = invokerReturning({
      "feed.releases": { ok: true, data: { not: "an array" } },
    });
    const out = await runQueries(plan(["a"]), invoker, { registry });
    expect(out.a).toEqual({ ok: false, error: { code: "invalid_response" } });
  });

  it("caps an oversized entry", async () => {
    const big = Array.from({ length: 5000 }, (_v, i) => i);
    const { invoker } = invokerReturning({ "feed.releases": { ok: true, data: big } });
    const out = await runQueries(plan(["a"]), invoker, {
      registry: { "release-feed": { deriveInvocation: () => null } },
      maxEntryBytes: 100,
    });
    expect(out.a).toEqual({ ok: false, error: { code: "invalid_request" } });
  });

  it("aborts the fan-out when the budget is spent", async () => {
    vi.useFakeTimers();
    const invoker: QueryInvoker = {
      invoke: (_id, _body, ctx) =>
        new Promise((_resolve, reject) => {
          ctx.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    };
    const promise = runQueries(plan(["a"]), invoker, { registry, budgetMs: 10 });
    await vi.advanceTimersByTimeAsync(11);
    const out = await promise;
    vi.useRealTimers();
    expect(out.a).toEqual({ ok: false, error: { code: "timeout" } });
  });
});

describe("derivePreviewSectionData", () => {
  const previewRegistry: Record<string, SectionQuerySpec> = {
    "release-feed": {
      deriveInvocation: (fields) =>
        typeof fields.source === "string" ? { actionId: fields.source, body: {} } : null,
      project: (result) => (Array.isArray(result) ? result.slice(0, 2) : null),
      previewSample: [{ n: 1 }, { n: 2 }, { n: 3 }],
    },
    "no-sample": {
      deriveInvocation: () => ({ actionId: "x", body: {} }),
    },
    "bad-sample": {
      deriveInvocation: () => ({ actionId: "y", body: {} }),
      project: () => null,
      previewSample: 42,
    },
  };

  it("projects each specced section's previewSample, keyed by instanceId", () => {
    const out = derivePreviewSectionData(
      [[node("a", "release-feed", { source: "feed.releases" }), node("x", "hero")]],
      "en",
      undefined,
      previewRegistry,
    );
    expect(out).toEqual({ a: { ok: true, data: [{ n: 1 }, { n: 2 }] } });
  });

  it("gives a section with no previewSample an error entry (renders its fallback)", () => {
    const out = derivePreviewSectionData(
      [[node("a", "no-sample")]],
      "en",
      undefined,
      previewRegistry,
    );
    expect(out.a).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("gives an error entry when project rejects the sample", () => {
    const out = derivePreviewSectionData(
      [[node("a", "bad-sample")]],
      "en",
      undefined,
      previewRegistry,
    );
    expect(out.a).toEqual({ ok: false, error: { code: "invalid_response" } });
  });

  it("skips a section whose deriveInvocation needs data it lacks", () => {
    const out = derivePreviewSectionData(
      [[node("a", "release-feed", {})]], // no `source`
      "en",
      undefined,
      previewRegistry,
    );
    expect(out).toEqual({});
  });
});
