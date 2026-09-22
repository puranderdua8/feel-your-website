import { describe, expect, it } from "vitest";

import { planGeneratedFiles } from "./mapping.js";
import type { RoutesSnapshot, SnapshotRoute } from "./snapshot.js";

const route = (overrides: Partial<SnapshotRoute> = {}): SnapshotRoute => ({
  routeKey: "help",
  path: "/help",
  parentKey: null,
  hasOutlet: false,
  offline: false,
  paramNames: [],
  ...overrides,
});

const snapshot = (routes: readonly SnapshotRoute[]): RoutesSnapshot => ({ version: 1, routes });

describe("planGeneratedFiles — the mapping table", () => {
  it("a top-level leaf becomes <segment>.tsx", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "about", path: "/about" })]),
    );
    expect(errors).toEqual([]);
    expect(files).toEqual([
      { routeKey: "about", source: expect.anything(), relativePath: "about.tsx", kind: "leaf" },
    ]);
  });

  it("a layout (hasOutlet) becomes <segment>/route.tsx + <segment>/index.tsx", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "blog", path: "/blog", hasOutlet: true })]),
    );
    expect(errors).toEqual([]);
    expect(files.map((f) => [f.relativePath, f.kind])).toEqual(
      expect.arrayContaining([
        ["blog/route.tsx", "layout"],
        ["blog/index.tsx", "leaf"],
      ]),
    );
    expect(files).toHaveLength(2);
  });

  it("a param child under a layout becomes <segment>/$param.tsx", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([
        route({ routeKey: "blog", path: "/blog", hasOutlet: true }),
        route({
          routeKey: "blog-slug",
          path: "/blog/:slug",
          parentKey: "blog",
          paramNames: ["slug"],
        }),
      ]),
    );
    expect(errors).toEqual([]);
    expect(files.find((f) => f.routeKey === "blog-slug")?.relativePath).toBe("blog/$slug.tsx");
  });

  it("nested params compose multiple $segments", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([
        route({
          routeKey: "docs-page",
          path: "/docs/:category/:page",
          paramNames: ["category", "page"],
        }),
      ]),
    );
    expect(errors).toEqual([]);
    expect(files[0]!.relativePath).toBe("docs/$category/$page.tsx");
  });

  it("root ('/') becomes index.tsx", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "home", path: "/" })]),
    );
    expect(errors).toEqual([]);
    expect(files[0]!.relativePath).toBe("index.tsx");
  });
});

describe("planGeneratedFiles — validation failures", () => {
  it("rejects a route colliding with a reserved prefix", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "admin", path: "/admin" })]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("reserved"))).toBe(true);
  });

  it("rejects a static segment that fails the slug rule", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "cafe", path: "/café" })]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("café"))).toBe(true);
  });

  it("rejects a child whose parentKey points at a route with no outlet", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([
        route({ routeKey: "help", path: "/help", hasOutlet: false }),
        route({ routeKey: "help-child", path: "/help/child", parentKey: "help" }),
      ]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("no outlet"))).toBe(true);
  });

  it("rejects a child whose parentKey doesn't exist in the snapshot", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "orphan", path: "/orphan", parentKey: "missing" })]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes('"missing"'))).toBe(true);
  });

  it("rejects two routes whose patterns match the same URLs", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([
        route({ routeKey: "blog-slug", path: "/blog/:slug", paramNames: ["slug"] }),
        route({ routeKey: "blog-id", path: "/blog/:id", paramNames: ["id"] }),
      ]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("match the same set of paths"))).toBe(true);
  });

  it("rejects paramNames that don't match the path's own params", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "blog-slug", path: "/blog/:slug", paramNames: [] })]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("paramNames"))).toBe(true);
  });

  it("rejects offline=true with non-empty paramNames", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([
        route({ routeKey: "blog-slug", path: "/blog/:slug", paramNames: ["slug"], offline: true }),
      ]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("offline"))).toBe(true);
  });

  it("rejects a malformed path", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "bad", path: "not-absolute" })]),
    );
    expect(files).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects a routeKey that doesn't match the slug rule", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "Not_A_Slug", path: "/help" })]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("routeKey"))).toBe(true);
  });

  it("reports two routes that generate the same file path", () => {
    // Distinct valid patterns that happen to produce the same file: a route
    // literally named "route" under a layout collides with that layout's own
    // route.tsx.
    const { files, errors } = planGeneratedFiles(
      snapshot([
        route({ routeKey: "blog", path: "/blog", hasOutlet: true }),
        route({ routeKey: "blog-route", path: "/blog/route" }),
      ]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("blog/route.tsx"))).toBe(true);
  });

  it("collects every error in one pass rather than stopping at the first", () => {
    const { errors } = planGeneratedFiles(
      snapshot([
        route({ routeKey: "admin", path: "/admin" }),
        route({ routeKey: "cafe", path: "/café" }),
      ]),
    );
    expect(errors).toHaveLength(2);
  });
});

describe("planGeneratedFiles — codegen-safety (injection attempts)", () => {
  it("never lets an attempted path-traversal segment reach a generated file path", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "evil", path: "/../../etc/passwd" })]),
    );
    expect(files).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("never lets a routeKey carrying JS/quote-breaking characters reach output", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: '"; process.exit(1); //', path: "/help" })]),
    );
    expect(files).toEqual([]);
    expect(errors.some((e) => e.includes("routeKey"))).toBe(true);
  });

  it("never lets a static segment carrying a template-literal break-out reach output", () => {
    const { files, errors } = planGeneratedFiles(
      snapshot([route({ routeKey: "evil2", path: "/${process.exit(1)}" })]),
    );
    expect(files).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});
