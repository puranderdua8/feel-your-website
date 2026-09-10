import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENT_TYPES, type AnalyticsEvent, type AnalyticsEventType } from "./types.js";

/**
 * A compile-time guard that the event union stays closed and
 * `ANALYTICS_EVENT_TYPES` stays complete: adding a variant without a `case`
 * here is a type error, and a stray `type` value fails `never`.
 */
function label(event: AnalyticsEvent): string {
  switch (event.type) {
    case "page":
      return `page ${event.path}`;
    case "section_view":
      return `section ${event.sectionKey}/${event.instanceId}`;
    case "click":
      return `click ${event.target.tag}`;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

describe("analytics event union", () => {
  it("ANALYTICS_EVENT_TYPES lists exactly the discriminants", () => {
    const seen = new Set<AnalyticsEventType>(ANALYTICS_EVENT_TYPES);
    expect(seen).toEqual(new Set(["page", "section_view", "click"]));
  });

  it("label() handles every variant", () => {
    const base = { sessionId: "s", seq: 1, ts: 0, path: "/p" } as const;
    expect(label({ ...base, type: "page" })).toBe("page /p");
    expect(label({ ...base, type: "section_view", sectionKey: "hero", instanceId: "a" })).toBe(
      "section hero/a",
    );
    expect(label({ ...base, type: "click", target: { tag: "button" } })).toBe("click button");
  });
});
