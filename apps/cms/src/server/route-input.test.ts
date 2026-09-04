import type { RouteCompositionSummary } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import {
  composeCandidatePath,
  isReservedRoutePath,
  parseParams,
  validateRouteInput,
} from "./route-input.js";

const summary = (
  over: Partial<RouteCompositionSummary> & Pick<RouteCompositionSummary, "id" | "path">,
): RouteCompositionSummary => ({
  name: over.id,
  pathSegment: over.path,
  parentId: null,
  published: true,
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("parseParams", () => {
  it("keeps well-formed entries and defaults a missing label to the name", () => {
    expect(parseParams([{ name: "slug", label: "Slug" }, { name: "x" }])).toEqual([
      { name: "slug", label: "Slug" },
      { name: "x", label: "x" },
    ]);
  });

  it("drops junk", () => {
    expect(parseParams([null, {}, { name: "" }, "nope", 5])).toEqual([]);
    expect(parseParams("not an array")).toEqual([]);
  });
});

describe("isReservedRoutePath", () => {
  it("flags /admin, not /", () => {
    expect(isReservedRoutePath("/admin")).toBe(true);
    expect(isReservedRoutePath("/")).toBe(false);
    expect(isReservedRoutePath("/blog")).toBe(false);
  });
});

describe("validateRouteInput", () => {
  const blank = {
    bundleId: null as string | null,
    parentId: null as string | null,
    pathSegment: "/blog",
    params: [],
    published: false,
    seo: {},
    siblings: [] as RouteCompositionSummary[],
  };

  it("accepts a plain top-level route", () => {
    expect(validateRouteInput(blank)).toEqual([]);
  });

  it("accepts a parameterised route whose params match the pattern", () => {
    const issues = validateRouteInput({
      ...blank,
      pathSegment: "/docs/:category/:page",
      params: [
        { name: "category", label: "Category" },
        { name: "page", label: "Page" },
      ],
      seo: { en: { title: "{{category}} - {{page}}" } },
    });
    expect(issues).toEqual([]);
  });

  it("rejects a bare `:` and other malformed patterns", () => {
    const issues = validateRouteInput({ ...blank, pathSegment: "/blog/:" });
    expect(issues.map((i) => i.field)).toContain("path");
  });

  it("rejects a parameter with no label", () => {
    const issues = validateRouteInput({
      ...blank,
      pathSegment: "/blog/:slug",
      params: [{ name: "slug", label: "" }],
    });
    expect(issues.some((i) => i.field === "params")).toBe(true);
  });

  it("rejects a params list that doesn't match the pattern's parameters", () => {
    const issues = validateRouteInput({
      ...blank,
      pathSegment: "/blog/:slug",
      params: [{ name: "other", label: "Other" }],
    });
    expect(issues.some((i) => i.field === "params")).toBe(true);
  });

  it("rejects a reserved path", () => {
    const issues = validateRouteInput({ ...blank, pathSegment: "/admin" });
    expect(issues.some((i) => i.field === "path" && i.message.includes("reserved"))).toBe(true);
  });

  it("rejects a route colliding with an existing pattern", () => {
    const issues = validateRouteInput({
      ...blank,
      pathSegment: "/blog/:id",
      siblings: [summary({ id: "existing", path: "/blog/:slug" })],
    });
    expect(issues.some((i) => i.field === "path" && i.message.includes("existing"))).toBe(true);
  });

  it("rejects self-parenting", () => {
    const issues = validateRouteInput({ ...blank, bundleId: "a", parentId: "a" });
    expect(issues.some((i) => i.field === "parent")).toBe(true);
  });

  it("rejects reparenting a route under its own child", () => {
    const siblings = [
      summary({ id: "docs", path: "/docs" }),
      summary({ id: "guide", path: "/docs/guide", pathSegment: "guide", parentId: "docs" }),
    ];
    // "guide"'s parent is "docs" — proposing "docs"'s parent be "guide" cycles.
    const issues = validateRouteInput({ ...blank, bundleId: "docs", parentId: "guide", siblings });
    expect(issues.some((i) => i.field === "parent")).toBe(true);
  });

  it("rejects publishing a child whose parent is a draft", () => {
    const siblings = [summary({ id: "parent", path: "/docs", published: false })];
    const issues = validateRouteInput({
      ...blank,
      parentId: "parent",
      pathSegment: "guide",
      published: true,
      siblings,
    });
    expect(issues.some((i) => i.field === "path" && i.message.includes("Publish the parent"))).toBe(
      true,
    );
  });

  it("rejects unpublishing a route with a published child", () => {
    const siblings = [
      summary({
        id: "child",
        path: "/docs/guide",
        pathSegment: "guide",
        parentId: "parent",
        published: true,
      }),
    ];
    const issues = validateRouteInput({
      ...blank,
      bundleId: "parent",
      pathSegment: "/docs",
      published: false,
      siblings,
    });
    expect(issues.some((i) => i.field === "path" && i.message.includes("Unpublish"))).toBe(true);
  });

  it("rejects an SEO template referencing an unknown parameter", () => {
    const issues = validateRouteInput({
      ...blank,
      pathSegment: "/blog/:slug",
      params: [{ name: "slug", label: "Slug" }],
      seo: { en: { title: "{{bogus}}" } },
    });
    expect(issues.some((i) => i.field === "seo")).toBe(true);
  });
});

describe("composeCandidatePath", () => {
  it("composes a child's absolute path from its parent", () => {
    const siblings = [summary({ id: "parent", path: "/docs" })];
    expect(composeCandidatePath({ parentId: "parent", pathSegment: ":slug", siblings })).toBe(
      "/docs/:slug",
    );
  });

  it("returns null when the parent can't be resolved", () => {
    expect(
      composeCandidatePath({ parentId: "missing", pathSegment: "x", siblings: [] }),
    ).toBeNull();
  });

  it("returns null for a malformed segment", () => {
    expect(
      composeCandidatePath({ parentId: null, pathSegment: "no leading slash", siblings: [] }),
    ).toBeNull();
  });
});
