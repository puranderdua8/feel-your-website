import type { RouteBundle } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { resolveRouteByKey } from "./route-content.js";

const bundle = (overrides: Partial<RouteBundle> = {}): RouteBundle => ({
  id: "uuid-1",
  routeKey: "blog-slug",
  path: "/blog/:slug",
  pathSegment: ":slug",
  parentId: "uuid-blog",
  paramNames: ["slug"],
  paramMeta: {},
  tree: [],
  seo: { en: { title: "{{slug}} — Blog" } },
  offline: false,
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("resolveRouteByKey", () => {
  it("returns 'not_found' for an undefined bundle (unpublished or unknown key)", () => {
    expect(resolveRouteByKey(undefined, "en", {})).toBe("not_found");
  });

  it("sanitises and returns each of the bundle's own paramNames", () => {
    const result = resolveRouteByKey(bundle(), "en", { slug: "hello-world" });
    expect(result).not.toBe("not_found");
    expect(result).not.toBe("invalid_params");
    if (typeof result === "string") throw new Error("unreachable");
    expect(result.params).toEqual({ slug: "hello-world" });
  });

  it("returns 'invalid_params' when a required param is missing", () => {
    expect(resolveRouteByKey(bundle(), "en", {})).toBe("invalid_params");
  });

  it("returns 'invalid_params' when a param value fails sanitizeParam", () => {
    expect(resolveRouteByKey(bundle(), "en", { slug: "../etc" })).toBe("invalid_params");
  });

  it("ignores params not in the bundle's own paramNames", () => {
    const result = resolveRouteByKey(bundle({ paramNames: [] }), "en", { slug: "hello" });
    if (typeof result === "string") throw new Error("unreachable");
    expect(result.params).toEqual({});
  });

  it("interpolates the bundle's own SEO with the sanitised params", () => {
    const result = resolveRouteByKey(bundle(), "en", { slug: "hello-world" });
    if (typeof result === "string") throw new Error("unreachable");
    expect(result.seo.title).toBe("hello-world — Blog");
  });

  it("returns {} SEO for a locale the bundle has none for", () => {
    const result = resolveRouteByKey(bundle(), "hi", { slug: "hello" });
    if (typeof result === "string") throw new Error("unreachable");
    expect(result.seo).toEqual({});
  });

  it("a static route (no paramNames) resolves with an empty params object", () => {
    const result = resolveRouteByKey(
      bundle({ routeKey: "help", path: "/help", paramNames: [], seo: {} }),
      "en",
      {},
    );
    if (typeof result === "string") throw new Error("unreachable");
    expect(result.params).toEqual({});
  });
});
