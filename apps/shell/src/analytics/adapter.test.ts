import { NoopAnalyticsAdapter } from "@feel-your-website/analytics-core";
import { GaAnalyticsAdapter } from "@feel-your-website/analytics-ga";
import { describe, expect, it } from "vitest";

import type { BootstrapPayload } from "@/server/bff";

import { createAnalyticsAdapter } from "./adapter";

const config = (
  over: Partial<BootstrapPayload["analytics"]> = {},
): BootstrapPayload["analytics"] => ({
  provider: "none",
  measurementId: null,
  collectorPath: "",
  sampleRate: 1,
  ...over,
});

describe("createAnalyticsAdapter", () => {
  it("returns a Noop adapter for provider 'none'", () => {
    expect(createAnalyticsAdapter(config())).toBeInstanceOf(NoopAnalyticsAdapter);
  });

  it("returns a GA adapter for provider 'ga' with a measurement id", () => {
    expect(
      createAnalyticsAdapter(config({ provider: "ga", measurementId: "G-XYZ" })),
    ).toBeInstanceOf(GaAnalyticsAdapter);
  });

  it("falls back to Noop for 'ga' with no measurement id", () => {
    expect(createAnalyticsAdapter(config({ provider: "ga" }))).toBeInstanceOf(NoopAnalyticsAdapter);
  });
});
