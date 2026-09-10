import { MemoryAnalyticsAdapter } from "@feel-your-website/analytics-core";
import { AnalyticsProvider } from "@feel-your-website/analytics-core/react";
import type { RouteSectionNode } from "@feel-your-website/content-core";
import { resetSectionObserver } from "@feel-your-website/section-registry";
import { act, render, screen, waitFor, type RenderResult } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RouteLayer, RoutePage } from "@/server/resolve-route-page";

const loadSectionData = vi.fn().mockResolvedValue({});
vi.mock("@/server/bff", () => ({
  loadSectionData: (arg: unknown) => loadSectionData(arg) as Promise<Record<string, unknown>>,
}));

const { RoutePageView } = await import("./route-page");

/** RoutePageView calls `useSectionView()`, so it must render under an AnalyticsProvider. */
function renderView(
  page: RoutePage,
  { consentGranted = false }: { consentGranted?: boolean } = {},
): RenderResult & { adapter: MemoryAnalyticsAdapter } {
  const adapter = new MemoryAnalyticsAdapter();
  const result = render(
    <AnalyticsProvider adapter={adapter} consentGranted={consentGranted}>
      <RoutePageView page={page} />
    </AnalyticsProvider>,
  );
  return Object.assign(result, { adapter });
}

afterEach(() => {
  resetSectionObserver();
  vi.unstubAllGlobals();
  loadSectionData.mockClear();
  loadSectionData.mockResolvedValue({});
});

const hero = (id: string, title: string): RouteSectionNode => ({
  instanceId: id,
  sectionKey: "hero",
  content: { en: { title } },
  slots: {},
});

const outlet = (id: string): RouteSectionNode => ({
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

const page = (layers: RouteLayer[]): RoutePage => ({
  pathname: "/home/about",
  locale: "en",
  params: {},
  pattern: "/home/about",
  chain: [
    { id: "home", path: "/home", href: "/home", title: "Home" },
    { id: "about", path: "/home/about", href: "/home/about", title: "About" },
  ],
  layers,
  seo: {},
});

describe("RoutePageView", () => {
  it("renders the matched route standalone when its parent has no outlet", () => {
    renderView(
      page([
        { bundleId: "home", tree: [hero("h", "Home page")], hasOutlet: false },
        { bundleId: "about", tree: [hero("a", "About page")], hasOutlet: false },
      ]),
    );

    // The child's content shows; the parent's does not swallow it.
    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Home page" })).toBeNull();
  });

  it("nests the matched route inside a parent that does have an outlet", () => {
    renderView(
      page([
        { bundleId: "home", tree: [hero("h", "Home page"), outlet("o")], hasOutlet: true },
        { bundleId: "about", tree: [hero("a", "About page")], hasOutlet: false },
      ]),
    );

    expect(screen.getByRole("heading", { name: "Home page" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
  });

  it("renders a lone top-level route unchanged", () => {
    renderView(page([{ bundleId: "about", tree: [hero("a", "About page")], hasOutlet: false }]));

    expect(screen.getByRole("heading", { name: "About page" })).toBeTruthy();
  });

  describe("deferred (non-blocking) sections", () => {
    it("shows a skeleton, then the data once the client fetch resolves", async () => {
      loadSectionData.mockResolvedValue({
        f: { ok: true, data: [{ title: "v1", url: "https://x/1", date: "2026-01-01" }] },
      });
      const p = page([{ bundleId: "r", tree: [feed("f")], hasOutlet: false }]);
      p.deferredSections = ["f"];

      renderView(p);

      expect(document.querySelectorAll(".bg-muted").length).toBeGreaterThan(0);
      expect(screen.queryByText(/unavailable right now/)).toBeNull();
      expect(loadSectionData).toHaveBeenCalledWith({ data: { path: "/home/about" } });

      await waitFor(() => expect(screen.getByRole("link", { name: "v1" })).toBeTruthy());
      expect(document.querySelectorAll(".bg-muted").length).toBe(0);
    });

    it("falls back to the section's own error state when the deferred fetch throws", async () => {
      loadSectionData.mockRejectedValue(new Error("boom"));
      const p = page([{ bundleId: "r", tree: [feed("f")], hasOutlet: false }]);
      p.deferredSections = ["f"];

      renderView(p);
      await waitFor(() => expect(screen.getByText(/unavailable right now/)).toBeTruthy());
    });

    it("does not fetch when there are no deferred sections", () => {
      renderView(page([{ bundleId: "r", tree: [feed("f")], hasOutlet: false }]));
      expect(loadSectionData).not.toHaveBeenCalled();
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

    const { adapter } = renderView(
      page([
        {
          bundleId: "about",
          tree: [hero("a", "About page"), hero("b", "More")],
          hasOutlet: false,
        },
      ]),
      { consentGranted: true },
    );

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
