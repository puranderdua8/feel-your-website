import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsoleAnalyticsSink, NoopAnalyticsAdapter } from "./noop.js";
import type { AnalyticsAdapter, AnalyticsEvent } from "./types.js";

const event = (seq: number): AnalyticsEvent => ({
  sessionId: "s1",
  seq,
  ts: 0,
  path: "/x",
  type: "page",
});

afterEach(() => vi.restoreAllMocks());

describe("NoopAnalyticsAdapter", () => {
  it("accepts every call without throwing or returning anything", () => {
    const adapter: AnalyticsAdapter = new NoopAnalyticsAdapter();
    expect(adapter.init({ consentGranted: true })).toBeUndefined();
    expect(() => adapter.identify("u1")).not.toThrow();
    expect(() => adapter.track(event(1))).not.toThrow();
  });
});

describe("ConsoleAnalyticsSink", () => {
  it("logs one line per event and resolves true", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sink = new ConsoleAnalyticsSink();

    const accepted = await sink.deliver([event(1), event(2)]);

    expect(accepted).toBe(true);
    expect(info).toHaveBeenCalledTimes(2);
    expect(info.mock.calls[0]?.[0]).toBe("[analytics]");
  });

  it("takes a custom label", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleAnalyticsSink("[fyw]").deliver([event(1)]);
    expect(info.mock.calls[0]?.[0]).toBe("[fyw]");
  });

  it("resolves true for an empty batch without logging", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await new ConsoleAnalyticsSink().deliver([])).toBe(true);
    expect(info).not.toHaveBeenCalled();
  });
});
