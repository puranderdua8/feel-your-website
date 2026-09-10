import { usePageview } from "@feel-your-website/analytics-core/react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Feeds the resolved pathname into the analytics pageview tracker. Rendered
 * inside `<AnalyticsProvider>`; emits nothing itself, and nothing at all while
 * consent is not granted.
 */
export function PageviewTracker(): null {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  usePageview(pathname);
  return null;
}
