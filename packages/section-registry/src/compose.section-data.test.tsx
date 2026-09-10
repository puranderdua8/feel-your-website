import type { RouteSectionNode } from "@feel-your-website/content-core";
import { describe, expect, it, vi } from "vitest";

/**
 * `renderComposition` hands each node its own `sectionData` entry, keyed by
 * `instanceId`, and `undefined` when there is no entry. Mock `renderSection`
 * to record its 6th argument (`data`).
 */
const dataArgs: unknown[] = [];
vi.mock("./registry.js", () => ({
  renderSection: (...args: unknown[]) => {
    dataArgs.push(args[5]);
    return null;
  },
}));

const { renderComposition } = await import("./compose.js");

const node = (instanceId: string): RouteSectionNode =>
  ({
    instanceId,
    sectionKey: "text",
    content: { en: { value: "x" } },
    slots: {},
  }) as RouteSectionNode;

describe("renderComposition sectionData threading", () => {
  it("passes each node its entry by instanceId, undefined otherwise", () => {
    dataArgs.length = 0;

    renderComposition([node("a"), node("b")], "en", {
      sectionData: { a: { ok: true, data: { hello: 1 } } },
    });

    expect(dataArgs).toEqual([{ ok: true, data: { hello: 1 } }, undefined]);
  });
});
