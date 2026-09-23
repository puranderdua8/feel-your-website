import type { JsonValue, RouteBundle, RouteSectionNode } from "@feel-your-website/content-core";
import type { QueryInvoker, SectionQuerySpec } from "@feel-your-website/section-registry";
import { describe, expect, it, vi } from "vitest";

import {
  deferredRouteContentSectionIds,
  loadRouteContentSectionData,
  routeContentRenderContext,
} from "./route-content-data.js";
import type { RouteContentResult } from "./route-content.js";

const node = (
  instanceId: string,
  sectionKey: string,
  fields: Record<string, JsonValue> = {},
): RouteSectionNode =>
  ({ instanceId, sectionKey, content: { en: fields }, slots: {} }) as RouteSectionNode;

const bundle = (tree: RouteSectionNode[]): RouteBundle => ({
  id: "uuid-1",
  routeKey: "blog-slug",
  path: "/blog/:slug",
  pathSegment: ":slug",
  parentId: null,
  paramNames: ["slug"],
  paramMeta: {},
  tree,
  seo: {},
  offline: false,
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const resolved = (tree: RouteSectionNode[]): RouteContentResult => ({
  bundle: bundle(tree),
  params: { slug: "hello" },
  seo: {},
});

const feedSpec: SectionQuerySpec = {
  deriveInvocation: (fields, route) =>
    typeof fields.source === "string"
      ? { actionId: fields.source, body: { slug: route?.params.slug ?? null } }
      : null,
};
const registry = { "release-feed": feedSpec };

describe("routeContentRenderContext", () => {
  it("lifts the route facts a section may read off one resolved bundle, with no chain", () => {
    expect(routeContentRenderContext(resolved([]), "/blog/hello", "en")).toEqual({
      params: { slug: "hello" },
      pathname: "/blog/hello",
      pattern: "/blog/:slug",
      chain: [],
      locale: "en",
    });
  });
});

describe("loadRouteContentSectionData", () => {
  it("returns {} and never touches the invoker when no section needs data", async () => {
    const invoke = vi.fn();
    const out = await loadRouteContentSectionData(
      resolved([node("a", "hero"), node("b", "release-feed")]),
      "/blog/hello",
      "en",
      { invoke } as QueryInvoker,
      { registry },
    );
    expect(out).toEqual({});
    expect(invoke).not.toHaveBeenCalled();
  });

  it("fetches only this bundle's own tree, passing the derived body", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true, data: [{ tag: "v1" }] });
    const out = await loadRouteContentSectionData(
      resolved([node("a", "release-feed", { source: "feed.releases" })]),
      "/blog/hello",
      "en",
      { invoke } as QueryInvoker,
      { registry },
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0]?.[0]).toBe("feed.releases");
    expect(invoke.mock.calls[0]?.[1]).toEqual({ slug: "hello" });
    expect(out.a).toEqual({ ok: true, data: [{ tag: "v1" }] });
  });

  it("maps a failed call to an error entry — rendering still proceeds", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: false, code: "rate_limited" });
    const out = await loadRouteContentSectionData(
      resolved([node("a", "release-feed", { source: "feed.releases" })]),
      "/blog/hello",
      "en",
      { invoke } as QueryInvoker,
      { registry },
    );
    expect(out.a).toEqual({ ok: false, error: { code: "rate_limited" } });
  });

  describe("blocking / deferred phases", () => {
    const blockingReg = { "release-feed": feedSpec };
    const deferredReg = { "release-feed": { ...feedSpec, blocking: false } };
    const tree = () => [node("a", "release-feed", { source: "feed.releases" })];

    it("deferredRouteContentSectionIds lists only the non-blocking sections", () => {
      expect(
        deferredRouteContentSectionIds(resolved(tree()), "/blog/hello", "en", blockingReg),
      ).toEqual([]);
      expect(
        deferredRouteContentSectionIds(resolved(tree()), "/blog/hello", "en", deferredReg),
      ).toEqual(["a"]);
    });

    it("phase 'deferred' runs a non-blocking section and skips a blocking one", async () => {
      const invoke = vi.fn().mockResolvedValue({ ok: true, data: [1] });

      const deferred = await loadRouteContentSectionData(
        resolved(tree()),
        "/blog/hello",
        "en",
        { invoke } as QueryInvoker,
        { registry: deferredReg, phase: "deferred" },
      );
      expect(deferred.a).toEqual({ ok: true, data: [1] });

      invoke.mockClear();
      const blocking = await loadRouteContentSectionData(
        resolved(tree()),
        "/blog/hello",
        "en",
        { invoke } as QueryInvoker,
        { registry: blockingReg, phase: "deferred" },
      );
      expect(blocking).toEqual({});
      expect(invoke).not.toHaveBeenCalled();
    });
  });
});
