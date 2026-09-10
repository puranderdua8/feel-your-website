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
