import { describe, expect, it } from "vitest";

import {
  MAX_ANALYTICS_BATCH,
  MAX_ANALYTICS_EVENT_BYTES,
  parseAnalyticsBatch,
} from "./analytics-ingest.js";

const page = (over: Record<string, unknown> = {}) => ({
  type: "page",
  sessionId: "s1",
  seq: 1,
  ts: 1,
  path: "/p",
  ...over,
});

describe("parseAnalyticsBatch", () => {
  it("returns [] for a non-batch input", () => {
    expect(parseAnalyticsBatch(null)).toEqual([]);
    expect(parseAnalyticsBatch({})).toEqual([]);
    expect(parseAnalyticsBatch({ events: "nope" })).toEqual([]);
  });

  it("keeps well-formed events and drops the rest", () => {
    const out = parseAnalyticsBatch({
      events: [
        page(),
        page({ type: "elsewhere" }), // unknown type
        page({ seq: "1" }), // bad envelope
        {
          type: "section_view",
          sessionId: "s",
          seq: 2,
          ts: 1,
          path: "/p",
          sectionKey: "h",
          instanceId: "i",
        },
        { type: "section_view", sessionId: "s", seq: 3, ts: 1, path: "/p" }, // missing fields
        { type: "click", sessionId: "s", seq: 4, ts: 1, path: "/p", target: { tag: "a" } },
        { type: "click", sessionId: "s", seq: 5, ts: 1, path: "/p", target: {} }, // no tag
        "not an object",
      ],
    });
    expect(out.map((e) => [e.type, e.seq])).toEqual([
      ["page", 1],
      ["section_view", 2],
      ["click", 4],
    ]);
  });

  it("caps the batch to MAX_ANALYTICS_BATCH", () => {
    const events = Array.from({ length: MAX_ANALYTICS_BATCH + 20 }, (_v, i) => page({ seq: i }));
    expect(parseAnalyticsBatch({ events })).toHaveLength(MAX_ANALYTICS_BATCH);
  });

  it("drops an oversized event", () => {
    const big = page({ path: "/" + "x".repeat(MAX_ANALYTICS_EVENT_BYTES) });
    expect(parseAnalyticsBatch({ events: [big, page()] })).toHaveLength(1);
  });
});
