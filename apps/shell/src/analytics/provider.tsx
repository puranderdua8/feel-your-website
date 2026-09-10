import type { AnalyticsAdapter } from "@feel-your-website/analytics-core";
import { AnalyticsProvider } from "@feel-your-website/analytics-core/react";
import { useConsent } from "@feel-your-website/consent-core/react";
import { useMemo, type ReactNode } from "react";

import { createAnalyticsAdapter } from "@/analytics/adapter";
import { ClickTracker } from "@/analytics/click";
import { PageviewTracker } from "@/analytics/pageview";
import type { BootstrapPayload } from "@/server/bff";

/**
 * Bridges consent into the analytics provider: reads `useConsent()` (so it must
 * sit inside `<ConsentProvider>`), builds the adapter once from bootstrap
 * config, hands both to `<AnalyticsProvider>`, and mounts the journey trackers
 * inside it. With no provider configured the adapter is Noop, and every emit is
 * gated on consent regardless — so this stays inert until GA lands.
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

  return (
    <AnalyticsProvider
      adapter={adapter}
      consentGranted={status === "granted"}
      collectorUrl={config.collectorPath || undefined}
      sampleRate={config.sampleRate}
    >
      <PageviewTracker />
      <ClickTracker />
      {children}
    </AnalyticsProvider>
  );
}
