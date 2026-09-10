import { describe, expect, it } from "vitest";

import { MemoryAnalyticsAdapter } from "./memory-adapter.js";
import type { AnalyticsEvent } from "./types.js";

const event = (seq: number): AnalyticsEvent => ({
  type: "page",
  sessionId: "s",
  seq,
  ts: 0,
  path: "/p",
});

describe("MemoryAnalyticsAdapter", () => {
  it("exposes the last init config and identify id", () => {
    const a = new MemoryAnalyticsAdapter();
    expect(a.config).toBeNull();
    expect(a.userId).toBeNull();

    a.init({ consentGranted: true, options: { id: "G-1" } });
    a.identify("u1");
    a.identify("u2");

    expect(a.config).toEqual({ consentGranted: true, options: { id: "G-1" } });
    expect(a.userId).toBe("u2");
  });

  it("throwOnTrack makes the Nth track() throw — a fault injector for consumers", () => {
    const a = new MemoryAnalyticsAdapter({ throwOnTrack: 2 });
    a.init({ consentGranted: true });
    expect(() => a.track(event(1))).not.toThrow();
    expect(() => a.track(event(2))).toThrow(/simulated vendor failure/);
    expect(() => a.track(event(3))).not.toThrow();
    expect(a.tracked.map((e) => e.seq)).toEqual([1, 3]);
  });

  it("reset() returns it to pristine", () => {
    const a = new MemoryAnalyticsAdapter();
    a.init({ consentGranted: true });
    a.identify("u1");
    a.track(event(1));

    a.reset();
    expect(a.tracked).toHaveLength(0);
    expect(a.config).toBeNull();
    expect(a.userId).toBeNull();
    a.track(event(9)); // buffered again, since config is null
    expect(a.tracked).toHaveLength(0);
  });
});
