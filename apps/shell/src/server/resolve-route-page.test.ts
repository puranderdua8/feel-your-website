import type { RouteBundle } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { resolveRoutePage, sanitizeParam } from "./resolve-route-page.js";

const bundle = (over: Partial<RouteBundle> & Pick<RouteBundle, "id" | "path">): RouteBundle => ({
  pathSegment: over.path,
  parentId: null,
  paramNames: [],
  paramMeta: {},
  tree: [{ instanceId: `${over.id}-root`, sectionKey: "hero", content: {}, slots: {} }],
  seo: {},
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const blog = bundle({ id: "blog", path: "/blog", seo: { en: { title: "Blog" } } });
const blogPost = bundle({
  id: "blog-post",
  path: "/blog/:slug",
  pathSegment: ":slug",
  parentId: "blog",
  paramNames: ["slug"],
  seo: { en: { title: "{{slug}} - Blog", canonical: "https://x.test/blog/{{slug}}" } },
});
const featured = bundle({ id: "featured", path: "/blog/featured", pathSegment: "featured" });

const manifest = [blog, blogPost, featured];

describe("resolveRoutePage", () => {
  it("matches a param pattern, extracts the param, and stacks the parent chain", () => {
    const page = resolveRoutePage("/blog/hello", manifest, "en");
    expect(page).not.toBeNull();
    expect(page!.params).toEqual({ slug: "hello" });
    expect(page!.pattern).toBe("/blog/:slug");
    expect(page!.layers.map((l) => l.bundleId)).toEqual(["blog", "blog-post"]);
    expect(page!.chain.map((c) => c.title)).toEqual(["Blog", "hello - Blog"]);
    expect(page!.chain.map((c) => c.href)).toEqual(["/blog", "/blog/hello"]);
    expect(page!.seo.title).toBe("hello - Blog");
    expect(page!.seo.canonical).toBe("https://x.test/blog/hello");
  });

  it("normalises a trailing slash", () => {
    expect(resolveRoutePage("/blog/hello/", manifest, "en")).toEqual(
      resolveRoutePage("/blog/hello", manifest, "en"),
    );
  });

  it("prefers a static pattern over a param one", () => {
    const page = resolveRoutePage("/blog/featured", manifest, "en");
    expect(page!.pattern).toBe("/blog/featured");
    expect(page!.params).toEqual({});
    expect(page!.layers.map((l) => l.bundleId)).toEqual(["featured"]);
  });

  it("returns null for a hostile param value", () => {
    expect(resolveRoutePage("/blog/%2e%2e", manifest, "en")).toBeNull();
    expect(resolveRoutePage("/blog/a%2Fb", manifest, "en")).toBeNull();
  });

  it("returns null for a reserved path even if the manifest has one", () => {
    const withAdmin = [...manifest, bundle({ id: "admin", path: "/admin" })];
    expect(resolveRoutePage("/admin", withAdmin, "en")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(resolveRoutePage("/nope", manifest, "en")).toBeNull();
  });

  it("falls back to the last path segment for a breadcrumb with no title", () => {
    const page = resolveRoutePage("/blog/featured", manifest, "en");
    expect(page!.chain.at(-1)!.title).toBe("featured");
  });

  it("falls back to the resolved param value, not the `:name` token, for a param route with no title", () => {
    const tags = bundle({ id: "tags", path: "/tags/:tag", paramNames: ["tag"] });
    const page = resolveRoutePage("/tags/react", [...manifest, tags], "en");
    expect(page!.chain.at(-1)!.title).toBe("react");
  });
});

describe("sanitizeParam", () => {
  const SLASH = String.fromCharCode(47);
  const BACKSLASH = String.fromCharCode(92);
  const NUL = String.fromCharCode(0);
  const SPACE = String.fromCharCode(32);

  it("accepts ordinary slugs", () => {
    expect(sanitizeParam("my-post_2.0")).toBe("my-post_2.0");
  });

  it("rejects separators, control chars, dot segments and over-long values", () => {
    expect(sanitizeParam(`a${SLASH}b`)).toBeNull();
    expect(sanitizeParam(`a${BACKSLASH}b`)).toBeNull();
    expect(sanitizeParam(`a${NUL}b`)).toBeNull();
    expect(sanitizeParam(`a${SPACE}b`)).toBeNull();
    expect(sanitizeParam("..")).toBeNull();
    expect(sanitizeParam(".")).toBeNull();
    expect(sanitizeParam("50%")).toBeNull();
    expect(sanitizeParam("x".repeat(1025))).toBeNull();
    expect(sanitizeParam("")).toBeNull();
  });
});
