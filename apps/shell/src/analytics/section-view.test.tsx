import { MemoryAnalyticsAdapter } from "@feel-your-website/analytics-core";
import { AnalyticsProvider } from "@feel-your-website/analytics-core/react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSectionView } from "./section-view";

describe("useSectionView", () => {
  it("returns a stable callback that emits a section_view event", () => {
    const adapter = new MemoryAnalyticsAdapter();
    const { result, rerender } = renderHook(() => useSectionView(), {
      wrapper: ({ children }) => (
        <AnalyticsProvider adapter={adapter} consentGranted>
          {children}
        </AnalyticsProvider>
      ),
    });

    const first = result.current;
    rerender();
    expect(result.current).toBe(first); // stable across renders

    act(() => result.current({ instanceId: "hero-1", sectionKey: "hero" }));
    expect(adapter.tracked).toEqual([
      expect.objectContaining({ type: "section_view", sectionKey: "hero", instanceId: "hero-1" }),
    ]);
  });
});
