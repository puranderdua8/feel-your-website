import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithRouter } from "@/test-utils/render-with-router";

import { renderCtaLink } from "./cta-link";

function link(overrides: Partial<Parameters<typeof renderCtaLink>[0]> = {}) {
  return renderCtaLink({
    href: "/about",
    internal: true,
    route: { pathname: "/about", search: "", hash: "" },
    newTab: false,
    label: "Go",
    children: "Go",
    className: "cta",
    ...overrides,
  });
}

describe("renderCtaLink", () => {
  it("makes an internal same-tab link a client-side router transition", async () => {
    const { router } = await renderWithRouter(link());
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("href")).toBe("/about");
    expect(anchor.hasAttribute("target")).toBe(false);
    expect(anchor.className).toContain("cta");

    fireEvent.click(anchor, { button: 0 });
    await waitFor(() => expect(router.state.location.pathname).toBe("/about"));
  });

  it("keeps an authored query and fragment on the router link", async () => {
    await renderWithRouter(
      link({
        href: "/blog/hello?ref=cta#comments",
        route: { pathname: "/blog/hello", search: "?ref=cta", hash: "comments" },
      }),
    );
    expect(screen.getByRole("link", { name: "Go" }).getAttribute("href")).toBe(
      "/blog/hello?ref=cta#comments",
    );
  });

  it("does not client-transition a modified click", async () => {
    const { router } = await renderWithRouter(link());
    fireEvent.click(screen.getByRole("link", { name: "Go" }), { button: 0, metaKey: true });
    expect(router.state.location.pathname).toBe("/");
  });

  it("renders an external link as a plain anchor", async () => {
    await renderWithRouter(
      link({ href: "https://example.com", internal: false, route: undefined }),
    );
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("href")).toBe("https://example.com");
    expect(anchor.hasAttribute("target")).toBe(false);
  });

  it("adds target and rel for a new tab", async () => {
    await renderWithRouter(link({ newTab: true }));
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("leaves a same-page fragment as a plain anchor", async () => {
    const { router } = await renderWithRouter(link({ href: "#section", route: undefined }));
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("href")).toBe("#section");
    fireEvent.click(anchor, { button: 0 });
    expect(router.state.location.pathname).toBe("/");
  });
});
