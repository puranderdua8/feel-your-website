import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { push } }),
}));

// Imported after the mock is registered.
const { renderCtaLink } = await import("./cta-link.js");

afterEach(() => {
  push.mockClear();
});

function link(overrides: Partial<Parameters<typeof renderCtaLink>[0]> = {}) {
  return renderCtaLink({
    href: "/about",
    internal: true,
    newTab: false,
    label: "Go",
    children: "Go",
    className: "cta",
    ...overrides,
  });
}

describe("renderCtaLink", () => {
  it("makes an internal same-tab link a client transition", () => {
    render(link());
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("href")).toBe("/about");
    expect(anchor.hasAttribute("target")).toBe(false);

    fireEvent.click(anchor, { button: 0 });
    expect(push).toHaveBeenCalledWith("/about");
  });

  it("does not intercept a modified click", () => {
    render(link());
    fireEvent.click(screen.getByRole("link", { name: "Go" }), {
      button: 0,
      metaKey: true,
      // keep jsdom from attempting the (unimplemented) navigation
      preventDefault: () => undefined,
    });
    // The real assertion: the handler saw the modifier and did nothing.
    expect(push).not.toHaveBeenCalled();
  });

  it("renders an external link as a plain anchor", () => {
    render(link({ href: "https://example.com", internal: false }));
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("href")).toBe("https://example.com");
    expect(anchor.hasAttribute("target")).toBe(false);
  });

  it("adds target and rel for a new tab", () => {
    render(link({ newTab: true }));
    const anchor = screen.getByRole("link", { name: "Go" });
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("does not client-transition a fragment href", () => {
    render(link({ href: "#section" }));
    fireEvent.click(screen.getByRole("link", { name: "Go" }), { button: 0 });
    expect(push).not.toHaveBeenCalled();
  });
});
