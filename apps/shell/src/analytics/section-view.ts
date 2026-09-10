import { useAnalytics } from "@feel-your-website/analytics-core/react";
import type { OnSectionInView } from "@feel-your-website/section-registry";
import { useCallback } from "react";

/**
 * The callback `renderComposition` fires the first time a section scrolls into
 * view — emits a `section_view` event. Stable across renders so a
 * `<SectionBoundary>` effect does not re-subscribe.
 */
export function useSectionView(): OnSectionInView {
  const { emit } = useAnalytics();
  return useCallback<OnSectionInView>(
    ({ instanceId, sectionKey }) => emit({ type: "section_view", sectionKey, instanceId }),
    [emit],
  );
}
