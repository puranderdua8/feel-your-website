import { NoopAnalyticsAdapter, type AnalyticsAdapter } from "@feel-your-website/analytics-core";

import type { BootstrapPayload } from "@/server/bff";

/**
 * Builds the client analytics adapter from the bootstrap config. The single
 * place a concrete adapter is named — like `server/adapters.ts` for the
 * backend seams.
 *
 * `provider: "none"` (the default) → {@link NoopAnalyticsAdapter}: the provider
 * tree still mounts, but nothing is sent. `"ga"` also returns Noop until the
 * GA adapter lands (B11).
 */
export function createAnalyticsAdapter(config: BootstrapPayload["analytics"]): AnalyticsAdapter {
  switch (config.provider) {
    case "ga":
    case "none":
    default:
      return new NoopAnalyticsAdapter();
  }
}
