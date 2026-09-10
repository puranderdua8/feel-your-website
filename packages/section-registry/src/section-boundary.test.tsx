import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSectionObserver, SectionBoundary } from "./section-boundary.js";

/** A controllable IntersectionObserver stand-in (jsdom has none). */
class MockIO {
  static instances: MockIO[] = [];
  readonly observed = new Set<Element>();
  constructor(readonly callback: IntersectionObserverCallback) {
    MockIO.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.add(el);
  }
  unobserve(el: Element): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
  }
  /** Simulate `el` scrolling into view. */
  enter(el: Element): void {
    this.callback(
      [{ target: el, isIntersecting: true } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  MockIO.instances = [];
  vi.stubGlobal("IntersectionObserver", MockIO);
});

afterEach(() => {
  resetSectionObserver();
  vi.unstubAllGlobals();
});

describe("SectionBoundary", () => {
  it("renders a wrapper div with the data attributes and its children", () => {
    const { container, getByText } = render(
      <SectionBoundary instanceId="i1" sectionKey="hero">
        <span>content</span>
      </SectionBoundary>,
    );
    const wrapper = container.firstElementChild!;
    expect(wrapper.getAttribute("data-section-instance")).toBe("i1");
    expect(wrapper.getAttribute("data-section-key")).toBe("hero");
    expect(getByText("content")).toBeTruthy();
  });

  it("fires onInView once when the section enters, then stops observing", () => {
    const onInView = vi.fn();
    const { container } = render(
      <SectionBoundary instanceId="i1" sectionKey="hero" onInView={onInView}>
        x
      </SectionBoundary>,
    );
    const el = container.firstElementChild!;
    const io = MockIO.instances[0]!;

    expect(io.observed.has(el)).toBe(true);
    io.enter(el);
    io.enter(el); // already fired — no second call

    expect(onInView).toHaveBeenCalledTimes(1);
    expect(onInView).toHaveBeenCalledWith({ instanceId: "i1", sectionKey: "hero" });
    expect(io.observed.has(el)).toBe(false);
  });

  it("shares one observer across many boundaries", () => {
    render(
      <>
        <SectionBoundary instanceId="a" sectionKey="hero" onInView={vi.fn()}>
          a
        </SectionBoundary>
        <SectionBoundary instanceId="b" sectionKey="footer" onInView={vi.fn()}>
          b
        </SectionBoundary>
      </>,
    );
    expect(MockIO.instances).toHaveLength(1);
    expect(MockIO.instances[0]!.observed.size).toBe(2);
  });

  it("does not observe when no onInView is given", () => {
    render(
      <SectionBoundary instanceId="i1" sectionKey="hero">
        x
      </SectionBoundary>,
    );
    expect(MockIO.instances).toHaveLength(0);
  });

  it("stops observing on unmount", () => {
    const { container, unmount } = render(
      <SectionBoundary instanceId="i1" sectionKey="hero" onInView={vi.fn()}>
        x
      </SectionBoundary>,
    );
    const el = container.firstElementChild!;
    const io = MockIO.instances[0]!;
    unmount();
    expect(io.observed.has(el)).toBe(false);
  });

  it("fires immediately when there is no IntersectionObserver", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    const onInView = vi.fn();
    render(
      <SectionBoundary instanceId="i1" sectionKey="hero" onInView={onInView}>
        x
      </SectionBoundary>,
    );
    expect(onInView).toHaveBeenCalledWith({ instanceId: "i1", sectionKey: "hero" });
  });
});
