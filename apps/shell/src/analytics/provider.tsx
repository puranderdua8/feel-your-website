import type { AnalyticsAdapter, AnalyticsEvent } from "@feel-your-website/analytics-core";
import { AnalyticsProvider } from "@feel-your-website/analytics-core/react";
import { useConsent } from "@feel-your-website/consent-core/react";
import { useMemo, type ReactNode } from "react";

import { createAnalyticsAdapter } from "@/analytics/adapter";
import { ClickTracker } from "@/analytics/click";
import { PageviewTracker } from "@/analytics/pageview";
import { ingestAnalytics } from "@/server/bff";
import type { BootstrapPayload } from "@/server/bff";

/**
 * Bridges consent into the analytics provider: reads `useConsent()` (so it must
 * sit inside `<ConsentProvider>`), builds the adapter once from bootstrap
 * config, hands it to `<AnalyticsProvider>` along with a `sendBatch` that POSTs
 * to the first-party collector (when one is configured), and mounts the journey
 * trackers inside it. Every emit is gated on consent, and with no provider
 * configured the adapter is a no-op.
 */
export function AppAnalyticsProvider({
  config,
  children,
}: {
  config: BootstrapPayload["analytics"];
  children: ReactNode;
}): React.JSX.Element {
  const { status } = useConsent();
  const adapter = useMemo<AnalyticsAdapter>(() => createAnalyticsAdapter(config), [config]);

  const sendBatch = useMemo(
    () =>
      config.collectorPath
        ? (events: readonly AnalyticsEvent[]): void => {
            void ingestAnalytics({ data: { events: [...events] } }).catch(() => {
              // The vendor adapter is the primary path; a dropped collector
              // batch is acceptable.
            });
          }
        : undefined,
    [config.collectorPath],
  );

  return (
    <AnalyticsProvider
      adapter={adapter}
      consentGranted={status === "granted"}
      sendBatch={sendBatch}
      sampleRate={config.sampleRate}
    >
      <PageviewTracker />
      <ClickTracker />
      {children}
    </AnalyticsProvider>
  );
}
