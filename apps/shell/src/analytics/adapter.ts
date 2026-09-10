import { NoopAnalyticsAdapter, type AnalyticsAdapter } from "@feel-your-website/analytics-core";
import { GaAnalyticsAdapter } from "@feel-your-website/analytics-ga";

import type { BootstrapPayload } from "@/server/bff";

/**
 * Builds the client analytics adapter from the bootstrap config. The single
 * place a concrete adapter is named — like `server/adapters.ts` for the
 * backend seams.
 *
 * `provider: "none"` (the default) → {@link NoopAnalyticsAdapter}: the provider
 * tree still mounts, but nothing is sent. `"ga"` with a measurement id →
 * {@link GaAnalyticsAdapter}.
 */
export function createAnalyticsAdapter(config: BootstrapPayload["analytics"]): AnalyticsAdapter {
  if (config.provider === "ga" && config.measurementId) {
    return new GaAnalyticsAdapter({ measurementId: config.measurementId });
  }
  return new NoopAnalyticsAdapter();
}
