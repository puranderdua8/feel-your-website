import type { JsonValue, RouteSectionNode } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { treeHasAction } from "./tree-ops.js";

const button = (fields: Record<string, JsonValue>): RouteSectionNode => ({
  instanceId: crypto.randomUUID(),
  sectionKey: "button",
  content: { en: fields },
  slots: {},
});

describe("treeHasAction", () => {
  it("is false for an empty tree", () => {
    expect(treeHasAction([])).toBe(false);
  });

  it("is false for a button in link mode", () => {
    expect(treeHasAction([button({ mode: "link", href: "/blog" })])).toBe(false);
  });

  it("is false for an action-mode button with no actionId yet", () => {
    expect(treeHasAction([button({ mode: "action", actionId: "" })])).toBe(false);
  });

  it("is true for an action-mode button with a non-empty actionId", () => {
    expect(treeHasAction([button({ mode: "action", actionId: "newsletter.subscribe" })])).toBe(
      true,
    );
  });

  it("finds an action button nested inside a slot", () => {
    const card: RouteSectionNode = {
      instanceId: crypto.randomUUID(),
      sectionKey: "card",
      content: {},
      slots: { cta: [button({ mode: "action", actionId: "newsletter.subscribe" })] },
    };
    expect(treeHasAction([card])).toBe(true);
  });

  it("ignores a non-button section that happens to have similar field names", () => {
    const hero: RouteSectionNode = {
      instanceId: crypto.randomUUID(),
      sectionKey: "hero",
      content: { en: { mode: "action", actionId: "newsletter.subscribe" } },
      slots: {},
    };
    expect(treeHasAction([hero])).toBe(false);
  });
});
