import type { LinkKind } from "@feel-your-website/analytics-core";
import { useClickTracking } from "@feel-your-website/analytics-core/react";
import { classifyHref } from "@feel-your-website/section-registry";

/** Reuse the CTA href classifier so `linkKind` on a click matches how the link renders. */
function toLinkKind(href: string): LinkKind {
  return classifyHref(href).kind;
}

/**
 * Mounts the one document-wide click listener inside `<AnalyticsProvider>`.
 * Emits nothing itself, and nothing at all while consent is not granted.
 */
export function ClickTracker(): null {
  useClickTracking({ classifyHref: toLinkKind });
  return null;
}
