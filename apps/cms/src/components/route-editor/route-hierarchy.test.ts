import type { RouteCompositionSummary } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { buildRouteForest, descendantIds, walkForest } from "./route-hierarchy.js";

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

describe("buildRouteForest / walkForest", () => {
  it("nests children under their parent, root-first, name-sorted", () => {
    const summaries = [
      summary({ id: "b", path: "/b", name: "Bravo" }),
      summary({ id: "a", path: "/a", name: "Alpha" }),
      summary({ id: "a1", path: "/a/one", parentId: "a", name: "One" }),
    ];
    const forest = buildRouteForest(summaries);
    expect(forest.map((n) => n.summary.id)).toEqual(["a", "b"]);
    expect(forest[0]!.children.map((n) => n.summary.id)).toEqual(["a1"]);

    const walked = [...walkForest(forest)].map(({ node, depth }) => [node.summary.id, depth]);
    expect(walked).toEqual([
      ["a", 0],
      ["a1", 1],
      ["b", 0],
    ]);
  });

  it("promotes a child of a missing parent to a root", () => {
    const forest = buildRouteForest([summary({ id: "orphan", path: "/x", parentId: "nope" })]);
    expect(forest.map((n) => n.summary.id)).toEqual(["orphan"]);
  });
});

describe("descendantIds", () => {
  it("returns every id under the given one, not the id itself", () => {
    const summaries = [
      summary({ id: "root", path: "/r" }),
      summary({ id: "child", path: "/r/c", parentId: "root" }),
      summary({ id: "grandchild", path: "/r/c/g", parentId: "child" }),
      summary({ id: "unrelated", path: "/u" }),
    ];
    expect(descendantIds("root", summaries)).toEqual(new Set(["child", "grandchild"]));
    expect(descendantIds("unrelated", summaries)).toEqual(new Set());
  });
});
