import { describe, expect, it } from "vitest";

import { validateButtonSection } from "./validate-button.js";

describe("validateButtonSection", () => {
  it("passes a link with a safe internal href", () => {
    expect(validateButtonSection({ mode: "link", href: "/about" })).toEqual([]);
  });

  it("passes a link with a safe external href", () => {
    expect(validateButtonSection({ mode: "link", href: "https://example.com" })).toEqual([]);
  });

  it("blocks a link with no href", () => {
    expect(validateButtonSection({ mode: "link" })).toEqual([
      { field: "href", message: "A link needs a URL.", blocking: true },
    ]);
  });

  it("blocks a link with an unsafe href", () => {
    const issues = validateButtonSection({ mode: "link", href: "javascript:alert(1)" });
    expect(issues[0]?.blocking).toBe(true);
    expect(issues[0]?.field).toBe("href");
  });

  it("warns (non-blocking) about an internal href matching no known route", () => {
    const issues = validateButtonSection(
      { mode: "link", href: "/ghost" },
      { knownRoutePatterns: ["/about", "/blog/:slug"] },
    );
    expect(issues).toEqual([
      { field: "href", message: expect.stringContaining("No published route"), blocking: false },
    ]);
  });

  it("accepts an internal href that matches a parameterised route", () => {
    expect(
      validateButtonSection(
        { mode: "link", href: "/blog/hello" },
        { knownRoutePatterns: ["/blog/:slug"] },
      ),
    ).toEqual([]);
  });

  it("blocks an internal href that is still a route pattern", () => {
    const issues = validateButtonSection(
      { mode: "link", href: "/blog/:slug" },
      { knownRoutePatterns: ["/blog/:slug"] },
    );
    expect(issues).toEqual([
      { field: "href", message: expect.stringContaining("route pattern"), blocking: true },
    ]);
  });

  it("never warns about the home page or a shell-owned reserved path", () => {
    for (const href of ["/", "/admin", "/admin/settings", "/?ref=x"]) {
      expect(
        validateButtonSection(
          { mode: "link", href },
          { knownRoutePatterns: ["/about"], deployedRoutePatterns: ["/about"] },
        ),
      ).toEqual([]);
    }
  });

  it("warns (non-blocking) about a published route not yet in the deployed build", () => {
    const issues = validateButtonSection(
      { mode: "link", href: "/blog/hello?ref=cta#comments" },
      { knownRoutePatterns: ["/about", "/blog/:slug"], deployedRoutePatterns: ["/about"] },
    );
    expect(issues).toEqual([
      { field: "href", message: expect.stringContaining("next deploy"), blocking: false },
    ]);
  });

  it("passes an internal href that is published and deployed", () => {
    expect(
      validateButtonSection(
        { mode: "link", href: "/blog/hello#comments" },
        { knownRoutePatterns: ["/blog/:slug"], deployedRoutePatterns: ["/blog/:slug"] },
      ),
    ).toEqual([]);
  });

  it("does not route-check a same-page fragment or query", () => {
    expect(
      validateButtonSection({ mode: "link", href: "#top" }, { knownRoutePatterns: ["/about"] }),
    ).toEqual([]);
  });

  it("does not check the href in action mode", () => {
    expect(validateButtonSection({ mode: "action", actionId: "newsletter.subscribe" })).toEqual([]);
  });

  it("blocks an action CTA that names no action", () => {
    expect(validateButtonSection({ mode: "action" })).toEqual([
      { field: "actionId", message: "An action CTA needs an action.", blocking: true },
    ]);
    expect(validateButtonSection({ mode: "action", actionId: "   " })[0]?.blocking).toBe(true);
  });

  it("treats an absent mode as link mode", () => {
    expect(validateButtonSection({ href: "/x" })).toEqual([]);
    expect(validateButtonSection({})[0]?.blocking).toBe(true);
  });
});
