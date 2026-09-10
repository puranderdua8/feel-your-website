import type { RouteSectionNode } from "@feel-your-website/content-core";
import { describe, expect, it, vi } from "vitest";

/**
 * `renderComposition` hands each node its own `sectionData` entry, keyed by
 * `instanceId`, and `undefined` when there is no entry. Mock `renderSection`
 * to record `extras.data` (its 4th argument is the extras object).
 */
const dataArgs: unknown[] = [];
vi.mock("./registry.js", () => ({
  renderSection: (...args: unknown[]) => {
    dataArgs.push((args[3] as { data?: unknown } | undefined)?.data);
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

  it("gives a pending-section id `{ pending: true }` only when it has no real entry", () => {
    dataArgs.length = 0;

    renderComposition([node("a"), node("b"), node("c")], "en", {
      sectionData: { a: { ok: true, data: 1 } },
      pendingSections: new Set(["a", "b"]),
    });

    // `a` has a real entry (wins); `b` is pending; `c` is neither.
    expect(dataArgs).toEqual([{ ok: true, data: 1 }, { pending: true }, undefined]);
  });
});
