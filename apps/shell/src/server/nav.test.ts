import type { RouteHeader } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { buildNav } from "./nav.js";

const header = (over: Partial<RouteHeader> & Pick<RouteHeader, "id" | "path">): RouteHeader => ({
  pathSegment: over.path,
  parentId: null,
  hasParams: over.path.includes(":"),
  title: {},
  ...over,
});

describe("buildNav", () => {
  it("builds a flat, title-sorted list of top-level routes", () => {
    const nav = buildNav(
      [
        header({ id: "b", path: "/blog", title: { en: "Blog" } }),
        header({ id: "a", path: "/about", title: { en: "About" } }),
      ],
      "en",
    );
    expect(nav.map((n) => n.title)).toEqual(["About", "Blog"]);
    expect(nav.every((n) => n.children.length === 0)).toBe(true);
  });

  it("nests a child under its parent", () => {
    const nav = buildNav(
      [
        header({ id: "docs", path: "/docs", title: { en: "Docs" } }),
        header({ id: "guide", path: "/docs/guide", parentId: "docs", title: { en: "Guide" } }),
      ],
      "en",
    );
    expect(nav).toHaveLength(1);
    expect(nav[0]!.children.map((c) => c.title)).toEqual(["Guide"]);
  });

  it("excludes a param route and everything under it", () => {
    const nav = buildNav(
      [
        header({ id: "blog", path: "/blog", title: { en: "Blog" } }),
        header({ id: "post", path: "/blog/:slug", parentId: "blog" }),
        header({ id: "reviews", path: "/blog/:slug/reviews", parentId: "post" }),
      ],
      "en",
    );
    expect(nav).toHaveLength(1);
    expect(nav[0]!.children).toEqual([]);
  });

  it("treats a child of an excluded/absent parent as a root", () => {
    const nav = buildNav(
      [
        header({ id: "post", path: "/blog/:slug" }),
        header({ id: "faq", path: "/faq", parentId: "post", title: { en: "FAQ" } }),
      ],
      "en",
    );
    expect(nav.map((n) => n.path)).toEqual(["/faq"]);
  });

  it("falls back to the last path segment when a title is missing for the locale", () => {
    const nav = buildNav([header({ id: "x", path: "/pricing", title: { hi: "मूल्य" } })], "en");
    expect(nav[0]!.title).toBe("pricing");
  });

  it("returns [] for no headers", () => {
    expect(buildNav([], "en")).toEqual([]);
  });
});
