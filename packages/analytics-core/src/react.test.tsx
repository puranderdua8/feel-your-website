import { act, render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MemoryAnalyticsAdapter } from "./memory-adapter.js";
import {
  AnalyticsProvider,
  useAnalytics,
  useClickTracking,
  usePageview,
  type AnalyticsProviderProps,
  type ClickTrackingOptions,
} from "./react.js";

let clock = 1_000;
const now = () => clock;
let idCounter = 0;
const newId = () => `session-${++idCounter}`;

afterEach(() => {
  clock = 1_000;
  idCounter = 0;
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup(over: Partial<AnalyticsProviderProps> = {}) {
  const adapter = over.adapter ?? new MemoryAnalyticsAdapter();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AnalyticsProvider
      adapter={adapter}
      consentGranted={over.consentGranted ?? true}
      sendBatch={over.sendBatch}
      sampleRate={over.sampleRate}
      flushIntervalMs={over.flushIntervalMs}
      now={now}
      newId={newId}
    >
      {children}
    </AnalyticsProvider>
  );
  wrapper.displayName = "TestAnalyticsWrapper";
  const view = renderHook(() => useAnalytics(), { wrapper });
  return { adapter: adapter as MemoryAnalyticsAdapter, ...view };
}

describe("AnalyticsProvider / useAnalytics", () => {
  it("throws outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAnalytics())).toThrow(/within an <AnalyticsProvider>/);
  });

  it("inits the adapter with the consent flag on mount", () => {
    const { adapter } = setup({ consentGranted: false });
    expect(adapter.config).toEqual({ consentGranted: false });
  });

  it("stamps the envelope and delivers to the adapter when consent is granted", () => {
    const { adapter, result } = setup();
    act(() => result.current.emit({ type: "page" }));

    expect(adapter.tracked).toHaveLength(1);
    expect(adapter.tracked[0]).toMatchObject({
      type: "page",
      sessionId: "session-1",
      seq: 1,
      ts: 1000,
      path: "/",
    });
  });

  it("increments seq per emit within the session", () => {
    const { adapter, result } = setup();
    act(() => {
      result.current.emit({ type: "page" });
      result.current.emit({ type: "click", target: { tag: "button" } });
    });
    expect(adapter.tracked.map((e) => e.seq)).toEqual([1, 2]);
  });

  it("emits nothing while consent is denied", () => {
    const { adapter, result } = setup({ consentGranted: false });
    act(() => result.current.emit({ type: "page" }));
    expect(adapter.tracked).toHaveLength(0);
  });

  it("emits nothing for a session outside the sample", () => {
    const { adapter, result } = setup({ sampleRate: 0 });
    act(() => result.current.emit({ type: "page" }));
    expect(adapter.tracked).toHaveLength(0);
  });

  it("passes identify() straight to the adapter", () => {
    const { adapter, result } = setup();
    act(() => result.current.identify("user-7"));
    expect(adapter.userId).toBe("user-7");
  });

  it("persists the session so a remount reuses the id", () => {
    const first = setup();
    act(() => first.result.current.emit({ type: "page" }));
    first.unmount();

    const second = setup();
    act(() => second.result.current.emit({ type: "page" }));
    expect(second.adapter.tracked[0]?.sessionId).toBe("session-1");
  });

  it("calls sendBatch with the queued events on the flush interval", () => {
    vi.useFakeTimers();
    const sendBatch = vi.fn();

    const { result } = setup({ sendBatch, flushIntervalMs: 5000 });
    act(() => result.current.emit({ type: "page" }));
    expect(sendBatch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(5000));
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(sendBatch.mock.calls[0]![0]).toHaveLength(1);
    expect(sendBatch.mock.calls[0]![0][0]).toMatchObject({ type: "page", seq: 1 });
  });

  it("flushes on pagehide and on visibilitychange to hidden", () => {
    const sendBatch = vi.fn();
    const { result } = setup({ sendBatch });

    act(() => result.current.emit({ type: "page" }));
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(sendBatch).toHaveBeenCalledTimes(1);

    act(() => result.current.emit({ type: "page" }));
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(sendBatch).toHaveBeenCalledTimes(2);
  });

  it("does not queue for the collector when no sendBatch is given", () => {
    const { result, adapter } = setup();
    act(() => result.current.emit({ type: "page" }));
    act(() => window.dispatchEvent(new Event("pagehide")));
    // Nothing to assert on a missing collector — just prove the adapter path
    // still worked and nothing threw.
    expect(adapter.tracked).toHaveLength(1);
  });

  it("swallows a throwing sendBatch", () => {
    const sendBatch = vi.fn(() => {
      throw new Error("boom");
    });
    const { result } = setup({ sendBatch });
    act(() => result.current.emit({ type: "page" }));
    expect(() => act(() => window.dispatchEvent(new Event("pagehide")))).not.toThrow();
  });
});

describe("usePageview", () => {
  function Harness({ path, adapter }: { path: string | null; adapter: MemoryAnalyticsAdapter }) {
    return (
      <AnalyticsProvider adapter={adapter} consentGranted now={now} newId={newId}>
        <PathEmitter path={path} />
      </AnalyticsProvider>
    );
  }
  function PathEmitter({ path }: { path: string | null }) {
    usePageview(path);
    return null;
  }

  it("emits a page event on mount for a non-null path, with the referrer", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://ref.test/");
    const adapter = new MemoryAnalyticsAdapter();
    render(<Harness path="/a" adapter={adapter} />);

    expect(adapter.tracked).toHaveLength(1);
    expect(adapter.tracked[0]).toMatchObject({
      type: "page",
      seq: 1,
      referrer: "https://ref.test/",
    });
  });

  it("emits again on a path change, without the referrer, and dedupes a repeat", () => {
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://ref.test/");
    const adapter = new MemoryAnalyticsAdapter();
    const { rerender } = render(<Harness path="/a" adapter={adapter} />);

    rerender(<Harness path="/a" adapter={adapter} />); // same path — no emit
    rerender(<Harness path="/b" adapter={adapter} />); // changed — emit

    expect(adapter.tracked.map((e) => [e.type, e.seq, "referrer" in e])).toEqual([
      ["page", 1, true],
      ["page", 2, false],
    ]);
  });

  it("emits nothing for a null path", () => {
    const adapter = new MemoryAnalyticsAdapter();
    render(<Harness path={null} adapter={adapter} />);
    expect(adapter.tracked).toHaveLength(0);
  });
});

describe("useClickTracking", () => {
  function Harness({
    adapter,
    options,
  }: {
    adapter: MemoryAnalyticsAdapter;
    options?: ClickTrackingOptions;
  }) {
    return (
      <AnalyticsProvider adapter={adapter} consentGranted now={now} newId={newId}>
        <Tracker options={options} />
        <a href="/about" id="link">
          About
        </a>
        <button id="btn" type="button">
          Save
        </button>
        <p id="prose">just text</p>
      </AnalyticsProvider>
    );
  }
  function Tracker({ options }: { options?: ClickTrackingOptions }) {
    useClickTracking(options);
    return null;
  }

  it("emits a click for a button, ignoring inert page text", () => {
    const adapter = new MemoryAnalyticsAdapter();
    render(<Harness adapter={adapter} />);

    document.getElementById("prose")!.click();
    expect(adapter.tracked).toHaveLength(0);

    document.getElementById("btn")!.click();
    expect(adapter.tracked).toHaveLength(1);
    expect(adapter.tracked[0]).toMatchObject({
      type: "click",
      target: { tag: "button", text: "Save" },
    });
  });

  it("classifies a link's href via the injected classifier", () => {
    const adapter = new MemoryAnalyticsAdapter();
    render(<Harness adapter={adapter} options={{ classifyHref: () => "internal" }} />);

    document.getElementById("link")!.click();
    expect(adapter.tracked[0]).toMatchObject({
      type: "click",
      linkKind: "internal",
      target: { tag: "a", href: "/about" },
    });
  });

  it("ignores a non-primary-button click", () => {
    const adapter = new MemoryAnalyticsAdapter();
    render(<Harness adapter={adapter} />);
    document
      .getElementById("btn")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, button: 2 }));
    expect(adapter.tracked).toHaveLength(0);
  });

  it("removes the listener on unmount", () => {
    const adapter = new MemoryAnalyticsAdapter();
    const { unmount } = render(<Harness adapter={adapter} />);
    unmount();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(adapter.tracked).toHaveLength(0);
  });
});
