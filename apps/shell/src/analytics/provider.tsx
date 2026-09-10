import type { AnalyticsAdapter } from "@feel-your-website/analytics-core";
import { AnalyticsProvider } from "@feel-your-website/analytics-core/react";
import { useConsent } from "@feel-your-website/consent-core/react";
import { useMemo, type ReactNode } from "react";

import { createAnalyticsAdapter } from "@/analytics/adapter";
import type { BootstrapPayload } from "@/server/bff";

/**
 * Bridges consent into the analytics provider: reads `useConsent()` (so it must
 * sit inside `<ConsentProvider>`), builds the adapter once from bootstrap
 * config, and hands both to `<AnalyticsProvider>`. The adapter is Noop until a
 * provider is configured, so this is inert today.
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
      {children}
    </AnalyticsProvider>
  );
}
