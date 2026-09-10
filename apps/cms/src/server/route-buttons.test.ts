import type { RouteSectionNode } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { collectRouteButtonIssues, firstUnsafeButtonHref } from "./route-buttons.js";

function button(
  instanceId: string,
  content: Record<string, Record<string, unknown>>,
): RouteSectionNode {
  return { instanceId, sectionKey: "button", content, slots: {} } as RouteSectionNode;
}

function card(instanceId: string, body: RouteSectionNode[]): RouteSectionNode {
  return { instanceId, sectionKey: "card", content: {}, slots: { body } } as RouteSectionNode;
}

describe("firstUnsafeButtonHref", () => {
  it("finds an unsafe href anywhere in the tree, including in a slot", () => {
    const tree = [
      button("a", { en: { mode: "link", href: "/ok" } }),
      card("c", [button("b", { en: { mode: "link", href: "javascript:alert(1)" } })]),
    ];
    expect(firstUnsafeButtonHref(tree)).toBe("javascript:alert(1)");
  });

  it("ignores an unsafe href on a non-link button", () => {
    const tree = [button("a", { en: { mode: "action", href: "javascript:x" } })];
    expect(firstUnsafeButtonHref(tree)).toBeNull();
  });

  it("returns null for a clean tree", () => {
    const tree = [button("a", { en: { mode: "link", href: "https://example.com" } })];
    expect(firstUnsafeButtonHref(tree)).toBeNull();
  });
});

describe("collectRouteButtonIssues", () => {
  it("flags a link with no href as blocking", () => {
    const issues = collectRouteButtonIssues([button("a", { en: { mode: "link" } })]);
    expect(issues).toEqual([{ instanceId: "a", message: "A link needs a URL.", blocking: true }]);
  });

  it("de-duplicates the same issue across locales", () => {
    const issues = collectRouteButtonIssues([
      button("a", { en: { mode: "link" }, fr: { mode: "link" } }),
    ]);
    expect(issues).toHaveLength(1);
  });

  it("warns (non-blocking) about an internal href matching no published route", () => {
    const issues = collectRouteButtonIssues(
      [button("a", { en: { mode: "link", href: "/ghost" } })],
      {
        knownRoutePatterns: ["/about", "/blog/:slug"],
      },
    );
    expect(issues).toEqual([
      { instanceId: "a", message: expect.stringContaining("No published route"), blocking: false },
    ]);
  });

  it("passes an internal href matching a parameterised route", () => {
    expect(
      collectRouteButtonIssues([button("a", { en: { mode: "link", href: "/blog/hello" } })], {
        knownRoutePatterns: ["/blog/:slug"],
      }),
    ).toEqual([]);
  });

  it("ignores non-button nodes and a well-formed action-mode button", () => {
    const tree = [
      button("a", { en: { mode: "action", actionId: "newsletter.subscribe" } }),
      card("c", []),
    ];
    expect(collectRouteButtonIssues(tree)).toEqual([]);
  });

  it("flags an action-mode button that names no action", () => {
    const issues = collectRouteButtonIssues([button("a", { en: { mode: "action" } })]);
    expect(issues).toEqual([
      { instanceId: "a", message: "An action CTA needs an action.", blocking: true },
    ]);
  });
});
