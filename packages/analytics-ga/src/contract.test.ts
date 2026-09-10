import { runAnalyticsAdapterContract } from "@feel-your-website/analytics-core/contract-tests";

import { GaAnalyticsAdapter } from "./GaAnalyticsAdapter.js";

// GA transforms events into `gtag` calls rather than keeping them, so only the
// "never throws / init is idempotent-safe" half of the contract applies; the
// envelope → GA4 mapping is asserted in `GaAnalyticsAdapter.test.ts`.
runAnalyticsAdapterContract({
  name: "GaAnalyticsAdapter",
  createAdapter: () =>
    new GaAnalyticsAdapter({ measurementId: "G-CONTRACT", loadScript: () => {}, gtag: () => {} }),
});
