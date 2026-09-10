import { afterEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_OFF, loadAnalyticsConfig, parseAnalyticsConfig } from "./analytics.js";

afterEach(() => vi.restoreAllMocks());

describe("parseAnalyticsConfig", () => {
  it("defaults to off when nothing is set", () => {
    expect(parseAnalyticsConfig({})).toEqual(ANALYTICS_OFF);
  });

  it("reads a full GA config", () => {
    expect(
      parseAnalyticsConfig({
        ANALYTICS_PROVIDER: "ga",
        ANALYTICS_GA_MEASUREMENT_ID: "G-ABC123",
        ANALYTICS_COLLECTOR_PATH: "/ingest",
        ANALYTICS_SAMPLE_RATE: "0.5",
      }),
    ).toEqual({
      provider: "ga",
      measurementId: "G-ABC123",
      collectorPath: "/ingest",
      sampleRate: 0.5,
    });
  });

  it("rejects an unknown provider", () => {
    expect(() => parseAnalyticsConfig({ ANALYTICS_PROVIDER: "matomo" })).toThrow(
      /Unknown ANALYTICS_PROVIDER/,
    );
  });

  it("requires a measurement id for ga", () => {
    expect(() => parseAnalyticsConfig({ ANALYTICS_PROVIDER: "ga" })).toThrow(
      /ANALYTICS_GA_MEASUREMENT_ID is required/,
    );
  });

  it("clamps the sample rate to [0, 1]", () => {
    expect(parseAnalyticsConfig({ ANALYTICS_SAMPLE_RATE: "2" }).sampleRate).toBe(1);
    expect(parseAnalyticsConfig({ ANALYTICS_SAMPLE_RATE: "-1" }).sampleRate).toBe(0);
  });

  it("rejects a non-numeric sample rate", () => {
    expect(() => parseAnalyticsConfig({ ANALYTICS_SAMPLE_RATE: "half" })).toThrow(
      /must be a number/,
    );
  });
});

describe("loadAnalyticsConfig", () => {
  it("degrades a bad config to off with a warning, never throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(loadAnalyticsConfig({ ANALYTICS_PROVIDER: "nope" })).toEqual(ANALYTICS_OFF);
    expect(error).toHaveBeenCalled();
  });

  it("returns the parsed config when valid", () => {
    expect(loadAnalyticsConfig({ ANALYTICS_PROVIDER: "none" })).toEqual(ANALYTICS_OFF);
  });
});
