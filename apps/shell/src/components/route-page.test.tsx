import type { RouteSectionNode } from "@feel-your-website/content-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RouteLayer, RoutePage } from "@/server/resolve-route-page";

import { RoutePageView } from "./route-page";

const hero = (id: string, title: string): RouteSectionNode => ({
  instanceId: id,
  sectionKey: "hero",
  content: { en: { title } },
  slots: {},
});

const outlet = (id: string): RouteSectionNode => ({
  instanceId: id,
  sectionKey: "outlet",
  content: {},
  slots: {},
});

const page = (layers: RouteLayer[]): RoutePage => ({
  pathname: "/home/about",
  locale: "en",
  params: {},
  pattern: "/home/about",
  chain: [
    { id: "home", path: "/home", href: "/home", title: "Home" },
    { id: "about", path: "/home/about", href: "/home/about", title: "About" },
  ],
  layers,
  seo: {},
});

describe("RoutePageView", () => {
  it("renders the matched route standalone when its parent has no outlet", () => {
    render(
      <RoutePageView
        page={page([
          { bundleId: "home", tree: [hero("h", "Home page")], hasOutlet: false },
          { bundleId: "about", tree: [hero("a", "About page")], hasOutlet: false },
        ])}
      />,
    );

    // The child's content shows; the parent's does not swallow it.
    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Home page" })).toBeNull();
  });

  it("nests the matched route inside a parent that does have an outlet", () => {
    render(
      <RoutePageView
        page={page([
          { bundleId: "home", tree: [hero("h", "Home page"), outlet("o")], hasOutlet: true },
          { bundleId: "about", tree: [hero("a", "About page")], hasOutlet: false },
        ])}
      />,
    );

    expect(screen.getByRole("heading", { name: "Home page" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
  });

  it("renders a lone top-level route unchanged", () => {
    render(
      <RoutePageView
        page={page([{ bundleId: "about", tree: [hero("a", "About page")], hasOutlet: false }])}
      />,
    );

    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
  });
});
