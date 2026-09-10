import { ConsoleAnalyticsSink } from "@feel-your-website/analytics-core";
import { afterEach, describe, expect, it } from "vitest";

import { getAnalyticsSink, resetAdapters } from "./adapters.js";

const saved = process.env.ANALYTICS_SINK;
afterEach(() => {
  if (saved === undefined) delete process.env.ANALYTICS_SINK;
  else process.env.ANALYTICS_SINK = saved;
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
    process.env.ANALYTICS_SINK = "ga";
    resetAdapters();
    expect(() => getAnalyticsSink()).toThrow(/Unknown ANALYTICS_SINK/);
  });
});
