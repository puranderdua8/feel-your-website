import type { RouteBundle } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { toOfflineRouteData } from "./offline-route-data.js";

const bundle = (overrides: Partial<RouteBundle> = {}): RouteBundle => ({
  id: "uuid-1",
  routeKey: "help",
  path: "/help",
  pathSegment: "/help",
  parentId: null,
  paramNames: [],
  paramMeta: {},
  tree: [{ instanceId: "help-root", sectionKey: "help", content: {}, slots: {} }],
  seo: { en: { title: "Help — feel-your-website" }, hi: { title: "सहायता — feel-your-website" } },
  offline: true,
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("toOfflineRouteData", () => {
  it("projects routeKey, path, tree and every locale's seo, dropping bundle-only fields", () => {
    const result = toOfflineRouteData(bundle());
    expect(result).toEqual({
      routeKey: "help",
      path: "/help",
      tree: [{ instanceId: "help-root", sectionKey: "help", content: {}, slots: {} }],
      seo: {
        en: { title: "Help — feel-your-website" },
        hi: { title: "सहायता — feel-your-website" },
      },
      hasOutlet: false,
    });
  });

  it("computes hasOutlet from the tree, not the bundle's own flags", () => {
    const withOutlet = bundle({
      tree: [{ instanceId: "o", sectionKey: "outlet", content: {}, slots: {} }],
    });
    expect(toOfflineRouteData(withOutlet).hasOutlet).toBe(true);
  });
});
