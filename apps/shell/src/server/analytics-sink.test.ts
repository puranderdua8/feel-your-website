import { ConsoleAnalyticsSink } from "@feel-your-website/analytics-core";
import { MeasurementProtocolSink } from "@feel-your-website/analytics-sink-ga";
import { afterEach, describe, expect, it } from "vitest";

import { getAnalyticsSink, resetAdapters } from "./adapters.js";

const savedKeys = [
  "ANALYTICS_SINK",
  "ANALYTICS_GA_MEASUREMENT_ID",
  "ANALYTICS_MP_API_SECRET",
] as const;
const saved = Object.fromEntries(savedKeys.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const key of savedKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetAdapters();
});

describe("getAnalyticsSink", () => {
  it("defaults to a console sink and memoises it", () => {
    delete process.env.ANALYTICS_SINK;
    resetAdapters();
    const sink = getAnalyticsSink();
    expect(sink).toBeInstanceOf(ConsoleAnalyticsSink);
    expect(getAnalyticsSink()).toBe(sink);
  });

  it("rebuilds after resetAdapters", () => {
    delete process.env.ANALYTICS_SINK;
    resetAdapters();
    const first = getAnalyticsSink();
    resetAdapters();
    expect(getAnalyticsSink()).not.toBe(first);
  });

  it("throws for an unknown ANALYTICS_SINK", () => {
    process.env.ANALYTICS_SINK = "warehouse";
    resetAdapters();
    expect(() => getAnalyticsSink()).toThrow(/Unknown ANALYTICS_SINK/);
  });

  it("builds the Measurement Protocol sink for ANALYTICS_SINK=ga with credentials", () => {
    process.env.ANALYTICS_SINK = "ga";
    process.env.ANALYTICS_GA_MEASUREMENT_ID = "G-XXXX";
    process.env.ANALYTICS_MP_API_SECRET = "s3cret";
    resetAdapters();
    expect(getAnalyticsSink()).toBeInstanceOf(MeasurementProtocolSink);
  });

  it("throws for ANALYTICS_SINK=ga without the measurement id or api secret", () => {
    process.env.ANALYTICS_SINK = "ga";
    delete process.env.ANALYTICS_GA_MEASUREMENT_ID;
    delete process.env.ANALYTICS_MP_API_SECRET;
    resetAdapters();
    expect(() => getAnalyticsSink()).toThrow(/ANALYTICS_MP_API_SECRET/);
  });
});
