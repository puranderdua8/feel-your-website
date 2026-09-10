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

function field(instanceId: string, name: string): RouteSectionNode {
  return {
    instanceId,
    sectionKey: "field",
    content: { en: { name, label: name } },
    slots: {},
  } as RouteSectionNode;
}

function form(
  instanceId: string,
  fields: RouteSectionNode[],
  cta: RouteSectionNode,
): RouteSectionNode {
  return {
    instanceId,
    sectionKey: "form",
    content: {},
    slots: { fields, cta: [cta] },
  } as RouteSectionNode;
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
      button("a", {
        en: {
          mode: "action",
          actionId: "newsletter.subscribe",
          body: JSON.stringify({ email: { source: "static", value: "x@y.z" } }),
        },
      }),
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

  it("flags an action id that is not registered", () => {
    const issues = collectRouteButtonIssues([
      button("a", { en: { mode: "action", actionId: "does.not.exist" } }),
    ]);
    expect(issues).toEqual([
      { instanceId: "a", message: '"does.not.exist" is not a registered action.', blocking: true },
    ]);
  });

  it("flags an action id that names a query, not a mutation", () => {
    const issues = collectRouteButtonIssues([
      button("a", { en: { mode: "action", actionId: "feed.releases" } }),
    ]);
    expect(issues[0]).toMatchObject({
      instanceId: "a",
      message: expect.stringContaining("data action"),
      blocking: true,
    });
  });

  it("flags a body mapping that is not valid JSON", () => {
    const issues = collectRouteButtonIssues([
      button("a", { en: { mode: "action", actionId: "newsletter.subscribe", body: "{ oops" } }),
    ]);
    expect(issues).toEqual([
      { instanceId: "a", message: "The request body is not valid.", blocking: true },
    ]);
  });

  it("surfaces validateActionBinding issues — an unmapped required input, a bad routeParam", () => {
    const unmapped = collectRouteButtonIssues([
      button("a", { en: { mode: "action", actionId: "newsletter.subscribe", body: "{}" } }),
    ]);
    expect(unmapped[0]?.message).toMatch(/^Request body — .*required/);
    expect(unmapped[0]?.blocking).toBe(true);

    const badParam = collectRouteButtonIssues(
      [
        button("a", {
          en: {
            mode: "action",
            actionId: "newsletter.subscribe",
            body: JSON.stringify({ email: { source: "routeParam", value: "slug" } }),
          },
        }),
      ],
      { routeParamNames: ["id"] }, // route has :id, not :slug
    );
    expect(badParam[0]?.message).toMatch(/Request body — .*no param for/);

    const okParam = collectRouteButtonIssues(
      [
        button("a", {
          en: {
            mode: "action",
            actionId: "newsletter.subscribe",
            body: JSON.stringify({ email: { source: "routeParam", value: "slug" } }),
          },
        }),
      ],
      { routeParamNames: ["slug"] },
    );
    expect(okParam).toEqual([]);
  });

  it("passes a formInput mapping that names a sibling field of the same form", () => {
    const cta = button("cta", {
      en: {
        mode: "action",
        actionId: "newsletter.subscribe",
        body: JSON.stringify({ email: { source: "formInput", value: "email" } }),
      },
    });
    const tree = [form("f", [field("f1", "email")], cta)];
    expect(collectRouteButtonIssues(tree)).toEqual([]);
  });

  it("flags a formInput mapping that names no field of its form", () => {
    const cta = button("cta", {
      en: {
        mode: "action",
        actionId: "newsletter.subscribe",
        body: JSON.stringify({ email: { source: "formInput", value: "e_mail" } }),
      },
    });
    const tree = [form("f", [field("f1", "email")], cta)];
    const issues = collectRouteButtonIssues(tree);
    expect(issues[0]).toMatchObject({ instanceId: "cta", blocking: true });
    expect(issues[0]?.message).toMatch(/form has no field for/);
  });

  it("flags a formInput mapping on a button that is not inside a form", () => {
    const issues = collectRouteButtonIssues([
      button("a", {
        en: {
          mode: "action",
          actionId: "newsletter.subscribe",
          body: JSON.stringify({ email: { source: "formInput", value: "email" } }),
        },
      }),
    ]);
    expect(issues[0]).toMatchObject({ instanceId: "a", blocking: true });
    expect(issues[0]?.message).toMatch(/inside a form section/);
  });
});
