import { describe, expect, it } from "vitest";

import { renderGeneratedFile, renderManifest } from "./codegen.js";
import { planGeneratedFiles } from "./mapping.js";
import { buildSnapshot } from "./snapshot.js";
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

describe("renderGeneratedFile", () => {
  it("a top-level leaf file wires cmsLoader/cmsHead/cmsRouteComponent, wrapped", () => {
    const { files } = planGeneratedFiles({
      version: 1,
      routes: [route({ routeKey: "about", path: "/about" })],
    });
    const source = renderGeneratedFile(files[0]!);
    expect(source).toContain('createFileRoute("/(cms)/about")');
    expect(source).toContain('loader: (ctx) => cmsLoader(ctx, "about")');
    expect(source).toContain("head: cmsHead");
    expect(source).toContain("component: cmsRouteComponent(true)");
    expect(source).toContain('from "@/cms-route"');
  });

  it("a nested leaf (has a parentKey) wires cmsRouteComponent unwrapped", () => {
    const { files } = planGeneratedFiles({
      version: 1,
      routes: [
        route({ routeKey: "blog", path: "/blog", hasOutlet: true }),
        route({
          routeKey: "blog-slug",
          path: "/blog/:slug",
          parentKey: "blog",
          paramNames: ["slug"],
        }),
      ],
    });
    const leaf = files.find((f) => f.routeKey === "blog-slug")!;
    const source = renderGeneratedFile(leaf);
    expect(source).toContain('loader: (ctx) => cmsLoader(ctx, "blog-slug")');
    expect(source).toContain("component: cmsRouteComponent(false)");
  });

  it("a layout file fetches and renders its own bundle, with <Outlet/> filling its outlet", () => {
    const { files } = planGeneratedFiles({
      version: 1,
      routes: [route({ routeKey: "blog", path: "/blog", hasOutlet: true })],
    });
    const layout = files.find((f) => f.kind === "layout")!;
    const source = renderGeneratedFile(layout);
    expect(source).toContain('createFileRoute("/(cms)/blog")');
    expect(source).toContain('loader: (ctx) => cmsLoader(ctx, "blog")');
    expect(source).toContain("head: cmsHead");
    expect(source).toContain("component: cmsLayoutRouteComponent(true)");
  });

  it("the layout's sibling index.tsx renders nothing — the layout already owns that bundle", () => {
    const { files } = planGeneratedFiles({
      version: 1,
      routes: [route({ routeKey: "blog", path: "/blog", hasOutlet: true })],
    });
    const index = files.find((f) => f.kind === "leaf")!;
    const source = renderGeneratedFile(index);
    expect(source).toContain('createFileRoute("/(cms)/blog/")');
    expect(source).toContain("component: NullRouteComponent");
    expect(source).not.toContain("cmsLoader");
    expect(source).not.toContain("loader:");
    expect(source).not.toContain("head:");
  });

  it("a param segment maps to $name in both the file path and the route id", () => {
    const { files } = planGeneratedFiles({
      version: 1,
      routes: [
        route({ routeKey: "blog", path: "/blog", hasOutlet: true }),
        route({
          routeKey: "blog-slug",
          path: "/blog/:slug",
          parentKey: "blog",
          paramNames: ["slug"],
        }),
      ],
    });
    const leaf = files.find((f) => f.routeKey === "blog-slug")!;
    expect(leaf.relativePath).toBe("blog/$slug.tsx");
    expect(renderGeneratedFile(leaf)).toContain('createFileRoute("/(cms)/blog/$slug")');
  });

  it("every generated file carries the @generated header", () => {
    const { files } = planGeneratedFiles({ version: 1, routes: [route()] });
    expect(renderGeneratedFile(files[0]!)).toContain("@generated");
  });

  it("only JSON.stringify'd values reach the output — no raw interpolation of the id", () => {
    const { files } = planGeneratedFiles({
      version: 1,
      routes: [route({ routeKey: "about", path: "/about" })],
    });
    const source = renderGeneratedFile(files[0]!);
    // The id appears exactly once, as a JSON.stringify'd string literal.
    expect(source.match(/createFileRoute\((.*)\)/)?.[1]).toBe('"/(cms)/about"');
  });
});

describe("renderManifest", () => {
  const snapshot: RoutesSnapshot = buildSnapshot([
    {
      id: "1",
      routeKey: "help",
      path: "/help",
      parentId: null,
      offline: false,
      paramNames: [],
      hasOutlet: false,
    },
    {
      id: "2",
      routeKey: "blog",
      path: "/blog",
      parentId: null,
      offline: true,
      paramNames: [],
      hasOutlet: true,
    },
  ]);

  it("lists every route with routeKey, path and offline, sorted by routeKey", () => {
    const source = renderManifest(snapshot);
    const blogIndex = source.indexOf('"blog"');
    const helpIndex = source.indexOf('"help"');
    expect(blogIndex).toBeGreaterThan(-1);
    expect(blogIndex).toBeLessThan(helpIndex);
    expect(source).toContain('"offline": true');
  });

  it("embeds a snapshot hash constant", () => {
    expect(renderManifest(snapshot)).toContain("CMS_ROUTES_SNAPSHOT_HASH");
  });

  it("is deterministic for the same snapshot", () => {
    expect(renderManifest(snapshot)).toBe(renderManifest(snapshot));
  });
});
