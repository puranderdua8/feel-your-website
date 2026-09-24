import type { RouteBundle } from "@feel-your-website/content-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RouteContent } from "@/server/bff";

let matches: unknown[] = [];
vi.mock("@tanstack/react-router", () => ({ useMatches: () => matches }));
// A stand-in for the router-backed link; its real behaviour is covered in app-link.test.
vi.mock("@/components/app-link", () => ({
  AppLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a data-app-link="" href={to}>
      {children}
    </a>
  ),
}));

const { Breadcrumbs } = await import("./breadcrumbs");

const routeContent = (over: Partial<RouteContent> = {}): RouteContent => ({
  routeKey: "about",
  path: "/about",
  locale: "en",
  params: {},
  tree: [] as unknown as RouteBundle["tree"],
  hasOutlet: false,
  seo: {},
  ...over,
});

const match = (id: string, pathname: string, loaderData: unknown) => ({ id, pathname, loaderData });

describe("Breadcrumbs", () => {
  it("renders nothing for a single matched bundle", () => {
    matches = [match("about", "/about", routeContent())];
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no match carries a resolved bundle (e.g. a non-CMS route)", () => {
    matches = [
      match("__root__", "/", { locale: "en", messages: {} }),
      match("/admin", "/admin", undefined),
    ];
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it("skips a match whose loaderData isn't a resolved bundle — e.g. the layout's own index sibling", () => {
    matches = [
      match(
        "blog-layout",
        "/blog",
        routeContent({ routeKey: "blog", path: "/blog", seo: { title: "Blog" } }),
      ),
      match("blog-index", "/blog", undefined),
    ];
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a crumb per resolved bundle, using each one's SEO title", () => {
    matches = [
      match(
        "blog",
        "/blog",
        routeContent({ routeKey: "blog", path: "/blog", seo: { title: "Blog" } }),
      ),
      match(
        "blog-slug",
        "/blog/hello",
        routeContent({
          routeKey: "blog-slug",
          path: "/blog/:slug",
          params: { slug: "hello" },
          seo: { title: "hello — Blog" },
        }),
      ),
    ];
    render(<Breadcrumbs />);

    const link = screen.getByRole("link", { name: "Blog" });
    expect(link.hasAttribute("data-app-link")).toBe(true);
    expect(link.getAttribute("href")).toBe("/blog");

    const current = screen.getByText("hello — Blog");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("falls back to the pattern's last segment, resolved for a :param, when SEO has no title", () => {
    matches = [
      match("blog", "/blog", routeContent({ routeKey: "blog", path: "/blog", seo: {} })),
      match(
        "blog-slug",
        "/blog/hello",
        routeContent({
          routeKey: "blog-slug",
          path: "/blog/:slug",
          params: { slug: "hello" },
          seo: {},
        }),
      ),
    ];
    render(<Breadcrumbs />);

    expect(screen.getByRole("link", { name: "blog" })).toBeTruthy();
    expect(screen.getByText("hello")).toBeTruthy();
  });
});
