import type { AnalyticsEvent } from "@feel-your-website/analytics-core";
import { describe, expect, it } from "vitest";

import { MP_MAX_EVENTS_PER_REQUEST, toMpEvent, toMpPayloads } from "./mp-events.js";

const base = { sessionId: "s1", seq: 1, ts: 1_700_000_000_000, path: "/p" };

describe("toMpEvent", () => {
  it("maps a page view, carrying journey identity and GA session params", () => {
    const mp = toMpEvent({ ...base, type: "page", title: "Home", referrer: "https://ref" });
    expect(mp.name).toBe("page_view");
    expect(mp.params).toMatchObject({
      engagement_time_msec: 1,
      session_id: "s1",
      fyw_session_id: "s1",
      fyw_seq: 1,
      page_path: "/p",
      page_title: "Home",
      page_referrer: "https://ref",
    });
  });

  it("omits optional page params when absent", () => {
    const mp = toMpEvent({ ...base, type: "page" });
    expect(mp.params).not.toHaveProperty("page_title");
    expect(mp.params).not.toHaveProperty("page_referrer");
  });

  it("maps a section view", () => {
    const mp = toMpEvent({
      ...base,
      type: "section_view",
      sectionKey: "hero",
      instanceId: "n1",
    });
    expect(mp.name).toBe("section_view");
    expect(mp.params).toMatchObject({ section_key: "hero", section_instance: "n1" });
  });

  it("maps a click with only the params that are set", () => {
    const mp = toMpEvent({
      ...base,
      type: "click",
      target: { tag: "a", href: "https://x.test", analyticsId: "cta" },
      linkKind: "external",
      newTab: true,
    });
    expect(mp.name).toBe("click");
    expect(mp.params).toMatchObject({
      target_tag: "a",
      link_url: "https://x.test",
      target_id: "cta",
      link_kind: "external",
      new_tab: true,
    });
    expect(mp.params).not.toHaveProperty("target_text");
  });
});

describe("toMpPayloads", () => {
  const page = (over: { sessionId: string; seq: number; ts?: number }): AnalyticsEvent => ({
    type: "page",
    path: "/p",
    ts: 1_700_000_000_000,
    ...over,
  });

  it("returns nothing for an empty batch", () => {
    expect(toMpPayloads([])).toEqual([]);
  });

  it("groups events by session into one payload each, preserving order", () => {
    const payloads = toMpPayloads([
      page({ sessionId: "a", seq: 1 }),
      page({ sessionId: "b", seq: 1 }),
      page({ sessionId: "a", seq: 2 }),
    ]);
    expect(payloads).toHaveLength(2);
    const a = payloads.find((p) => p.client_id === "a")!;
    expect(a.events.map((e) => e.params.fyw_seq)).toEqual([1, 2]);
    expect(a.timestamp_micros).toBe(1_700_000_000_000 * 1000);
  });

  it("splits a session's events into chunks of 25", () => {
    const many = Array.from({ length: MP_MAX_EVENTS_PER_REQUEST + 3 }, (_, i) =>
      page({ sessionId: "a", seq: i + 1 }),
    );
    const payloads = toMpPayloads(many);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]!.events).toHaveLength(MP_MAX_EVENTS_PER_REQUEST);
    expect(payloads[1]!.events).toHaveLength(3);
  });
});
