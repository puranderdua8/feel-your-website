import { MemoryAnalyticsAdapter } from "@feel-your-website/analytics-core";
import { AnalyticsProvider } from "@feel-your-website/analytics-core/react";
import type { RouteBundle, RouteSectionNode } from "@feel-your-website/content-core";
import { resetSectionObserver } from "@feel-your-website/section-registry";
import { act, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RouteContent } from "@/server/bff";

const loadSectionDataByKey = vi.fn().mockResolvedValue({});
vi.mock("@/server/bff", () => ({
  loadSectionDataByKey: (arg: unknown) =>
    loadSectionDataByKey(arg) as Promise<Record<string, unknown>>,
}));
// Breadcrumbs reads `useMatches()`, which needs a real router — out of scope
// for this component's own tests; see `breadcrumbs.test.tsx`.
vi.mock("@/components/breadcrumbs", () => ({ Breadcrumbs: () => null }));

const { RouteContentView } = await import("./route-content-view");

/** RouteContentView calls `useSectionView()`, so it must render under an AnalyticsProvider. */
function renderView(
  content: RouteContent,
  {
    consentGranted = false,
    outlet = null,
  }: { consentGranted?: boolean; outlet?: React.ReactNode } = {},
): RenderResult & { adapter: MemoryAnalyticsAdapter } {
  const adapter = new MemoryAnalyticsAdapter();
  const result = render(
    <AnalyticsProvider adapter={adapter} consentGranted={consentGranted}>
      <RouteContentView content={content} outlet={outlet} wrap />
    </AnalyticsProvider>,
  );
  return Object.assign(result, { adapter });
}

afterEach(() => {
  resetSectionObserver();
  vi.unstubAllGlobals();
  loadSectionDataByKey.mockClear();
  loadSectionDataByKey.mockResolvedValue({});
});

const hero = (id: string, title: string): RouteSectionNode => ({
  instanceId: id,
  sectionKey: "hero",
  content: { en: { title } },
  slots: {},
});

const outletNode = (id: string): RouteSectionNode => ({
  instanceId: id,
  sectionKey: "outlet",
  content: {},
  slots: {},
});

const feed = (id: string): RouteSectionNode => ({
  instanceId: id,
  sectionKey: "release-feed",
  content: { en: { heading: "Latest" } },
  slots: {},
});

const content = (
  tree: RouteSectionNode[],
  overrides: Partial<RouteContent> = {},
): RouteContent => ({
  routeKey: "about",
  path: "/about",
  locale: "en",
  params: {},
  tree: tree as unknown as RouteBundle["tree"],
  hasOutlet: false,
  seo: {},
  ...overrides,
});

describe("RouteContentView", () => {
  it("renders its own tree standalone when outlet is null", () => {
    renderView(content([hero("a", "About page")]));
    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
  });

  it("fills the tree's outlet node with the given outlet content", () => {
    renderView(content([hero("h", "Blog"), outletNode("o")]), {
      outlet: <p>child content</p>,
    });
    expect(screen.getByRole("heading", { name: "Blog" })).toBeTruthy();
    expect(screen.getByText("child content")).toBeTruthy();
  });

  describe("deferred (non-blocking) sections", () => {
    it("shows a skeleton, then the data once the client fetch resolves", async () => {
      loadSectionDataByKey.mockResolvedValue({
        f: { ok: true, data: [{ title: "v1", url: "https://x/1", date: "2026-01-01" }] },
      });
      const c = content([feed("f")], { routeKey: "releases", deferredSections: ["f"] });

      renderView(c);

      expect(document.querySelectorAll(".bg-muted").length).toBeGreaterThan(0);
      expect(screen.queryByText(/unavailable right now/)).toBeNull();
      expect(loadSectionDataByKey).toHaveBeenCalledWith({
        data: { routeKey: "releases", params: {} },
      });

      await waitFor(() => expect(screen.getByRole("link", { name: "v1" })).toBeTruthy());
      expect(document.querySelectorAll(".bg-muted").length).toBe(0);
    });

    it("falls back to the section's own error state when the deferred fetch throws", async () => {
      loadSectionDataByKey.mockRejectedValue(new Error("boom"));
      const c = content([feed("f")], { deferredSections: ["f"] });

      renderView(c);
      await waitFor(() => expect(screen.getByText(/unavailable right now/)).toBeTruthy());
    });

    it("does not fetch when there are no deferred sections", () => {
      renderView(content([feed("f")]));
      expect(loadSectionDataByKey).not.toHaveBeenCalled();
    });
  });

  it("emits an ordered section_view per section as it scrolls into view", () => {
    class MockIO {
      static last: MockIO | undefined;
      readonly seen: Element[] = [];
      constructor(readonly cb: IntersectionObserverCallback) {
        MockIO.last = this;
      }
      observe(el: Element): void {
        this.seen.push(el);
      }
      unobserve(): void {}
      disconnect(): void {}
      enter(el: Element): void {
        this.cb(
          [{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIO);

    const { adapter } = renderView(content([hero("a", "About page"), hero("b", "More")]), {
      consentGranted: true,
    });

    const io = MockIO.last!;
    const first = document.querySelector("[data-section-instance='a']")!;
    const second = document.querySelector("[data-section-instance='b']")!;
    expect(io.seen).toEqual([first, second]);

    act(() => io.enter(second));
    act(() => io.enter(first));

    expect(
      adapter.tracked.map((e) => [e.type, (e as { instanceId?: string }).instanceId, e.seq]),
    ).toEqual([
      ["section_view", "b", 1],
      ["section_view", "a", 2],
    ]);
  });
});
