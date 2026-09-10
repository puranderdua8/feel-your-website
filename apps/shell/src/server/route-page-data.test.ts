import type { JsonValue, RouteSectionNode } from "@feel-your-website/content-core";
import type { QueryInvoker, SectionQuerySpec } from "@feel-your-website/section-registry";
import { describe, expect, it, vi } from "vitest";

import type { RoutePage } from "./resolve-route-page.js";
import { deferredSectionIds, loadRouteSectionData, routeRenderContext } from "./route-page-data.js";

const node = (
  instanceId: string,
  sectionKey: string,
  fields: Record<string, JsonValue> = {},
): RouteSectionNode =>
  ({ instanceId, sectionKey, content: { en: fields }, slots: {} }) as RouteSectionNode;

const page = (trees: RouteSectionNode[][]): RoutePage => ({
  pathname: "/blog/hello",
  locale: "en",
  params: { slug: "hello" },
  pattern: "/blog/:slug",
  chain: [{ id: "blog-post", path: "/blog/:slug", href: "/blog/hello", title: "hello" }],
  layers: trees.map((tree, i) => ({ bundleId: `b${i}`, tree, hasOutlet: false })),
  seo: {},
});

const feedSpec: SectionQuerySpec = {
  deriveInvocation: (fields, route) =>
    typeof fields.source === "string"
      ? { actionId: fields.source, body: { slug: route?.params.slug ?? null } }
      : null,
};
const registry = { "release-feed": feedSpec };

describe("routeRenderContext", () => {
  it("lifts the route facts a section may read off the page", () => {
    expect(routeRenderContext(page([[]]))).toEqual({
      params: { slug: "hello" },
      pathname: "/blog/hello",
      pattern: "/blog/:slug",
      chain: [{ id: "blog-post", path: "/blog/:slug", href: "/blog/hello", title: "hello" }],
      locale: "en",
    });
  });
});

describe("loadRouteSectionData", () => {
  it("returns {} and never touches the invoker when no section needs data", async () => {
    const invoke = vi.fn();
    const out = await loadRouteSectionData(
      page([[node("a", "hero"), node("b", "release-feed")]]),
      { invoke } as QueryInvoker,
      { registry },
    );
    expect(out).toEqual({});
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fans out across layers, passing the derived body, and keys entries by instanceId", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true, data: [{ tag: "v1" }] });
    const out = await loadRouteSectionData(
      page([
        [node("a", "release-feed", { source: "feed.releases" })],
        [node("b", "release-feed", { source: "feed.releases" })],
      ]),
      { invoke } as QueryInvoker,
      { registry },
    );

    // Identical invocation across both layers → one upstream call, shared result.
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[0]).toBe("feed.releases");
    expect(invoke.mock.calls[0]?.[1]).toEqual({ slug: "hello" });
    expect(out.a).toEqual({ ok: true, data: [{ tag: "v1" }] });
    expect(out.b).toEqual({ ok: true, data: [{ tag: "v1" }] });
  });

  it("maps a failed call to an error entry — the page still renders", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: false, code: "rate_limited" });
    const out = await loadRouteSectionData(
      page([[node("a", "release-feed", { source: "feed.releases" })]]),
      { invoke } as QueryInvoker,
      { registry },
    );
    expect(out.a).toEqual({ ok: false, error: { code: "rate_limited" } });
  });

  it("maps a rejected call to an error entry rather than propagating", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("boom"));
    const out = await loadRouteSectionData(
      page([[node("a", "release-feed", { source: "feed.releases" })]]),
      { invoke } as QueryInvoker,
      { registry },
    );
    expect(out.a).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  describe("blocking / deferred phases", () => {
    const blockingReg = { "release-feed": feedSpec };
    const deferredReg = { "release-feed": { ...feedSpec, blocking: false } };
    const tree = () => [[node("a", "release-feed", { source: "feed.releases" })]];

    it("deferredSectionIds lists only the non-blocking sections", () => {
      expect(deferredSectionIds(page(tree()), blockingReg)).toEqual([]);
      expect(deferredSectionIds(page(tree()), deferredReg)).toEqual(["a"]);
    });

    it("the default (blocking) phase skips a non-blocking section", async () => {
      const invoke = vi.fn();
      const out = await loadRouteSectionData(page(tree()), { invoke } as QueryInvoker, {
        registry: deferredReg,
      });
      expect(out).toEqual({});
      expect(invoke).not.toHaveBeenCalled();
    });

    it("phase 'deferred' runs a non-blocking section and skips a blocking one", async () => {
      const invoke = vi.fn().mockResolvedValue({ ok: true, data: [1] });

      const deferred = await loadRouteSectionData(page(tree()), { invoke } as QueryInvoker, {
        registry: deferredReg,
        phase: "deferred",
      });
      expect(deferred.a).toEqual({ ok: true, data: [1] });

      invoke.mockClear();
      const blocking = await loadRouteSectionData(page(tree()), { invoke } as QueryInvoker, {
        registry: blockingReg,
        phase: "deferred",
      });
      expect(blocking).toEqual({});
      expect(invoke).not.toHaveBeenCalled();
    });
  });
});
