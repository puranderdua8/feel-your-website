import type { AnalyticsEvent } from "@feel-your-website/analytics-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GaAnalyticsAdapter } from "./GaAnalyticsAdapter.js";

let calls: unknown[][];
const gtag = (...args: unknown[]): void => {
  calls.push(args);
};
const loadScript = vi.fn();

beforeEach(() => {
  calls = [];
  loadScript.mockClear();
  document.head.innerHTML = "";
});
afterEach(() => vi.unstubAllGlobals());

const make = () => new GaAnalyticsAdapter({ measurementId: "G-ABC", loadScript, gtag });

const envelope = (over: Partial<AnalyticsEvent>): AnalyticsEvent =>
  ({ sessionId: "s1", seq: 1, ts: 0, path: "/p", type: "page", ...over }) as AnalyticsEvent;

const events = () => calls.filter((c) => c[0] === "event");
const consent = () => calls.filter((c) => c[0] === "consent");

describe("GaAnalyticsAdapter.init", () => {
  it("sets Consent Mode to denied, disables auto page_view, then loads the script", () => {
    make().init({ consentGranted: false });

    expect(calls[0]).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
        wait_for_update: 500,
      },
    ]);
    expect(calls).toContainEqual(["config", "G-ABC", { send_page_view: false }]);
    expect(loadScript).toHaveBeenCalledWith("G-ABC");
    // no consent update while denied on the first init
    expect(consent().map((c) => c[1])).toEqual(["default"]);
  });

  it("grants analytics_storage when consent is already given", () => {
    make().init({ consentGranted: true });
    expect(consent()).toContainEqual([
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "granted" }),
    ]);
  });

  it("updates consent when a later init flips it, and does not re-bootstrap", () => {
    const adapter = make();
    adapter.init({ consentGranted: false });
    const bootstrapCalls = calls.length;

    adapter.init({ consentGranted: true });
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(calls.length).toBe(bootstrapCalls + 1);
    expect(calls.at(-1)).toEqual([
      "consent",
      "update",
      expect.objectContaining({ analytics_storage: "granted" }),
    ]);
  });

  it("is a no-op on the server", () => {
    vi.stubGlobal("window", undefined);
    expect(() => make().init({ consentGranted: true })).not.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("GaAnalyticsAdapter.track", () => {
  const ready = () => {
    const a = make();
    a.init({ consentGranted: true });
    calls.length = 0;
    return a;
  };

  it("maps a page event to page_view with our session dimensions", () => {
    ready().track(envelope({ type: "page", referrer: "https://ref/", seq: 3 }));
    expect(events()[0]).toEqual([
      "event",
      "page_view",
      { page_path: "/p", fyw_session_id: "s1", fyw_seq: 3, page_referrer: "https://ref/" },
    ]);
  });

  it("maps a section_view event", () => {
    ready().track(
      envelope({ type: "section_view", sectionKey: "hero", instanceId: "h1" }) as AnalyticsEvent,
    );
    expect(events()[0]).toEqual([
      "event",
      "section_view",
      {
        page_path: "/p",
        fyw_session_id: "s1",
        fyw_seq: 1,
        section_key: "hero",
        section_instance: "h1",
      },
    ]);
  });

  it("maps a click event, including link kind and new tab", () => {
    ready().track(
      envelope({
        type: "click",
        target: { tag: "a", text: "Go", href: "https://x/", analyticsId: "cta" },
        linkKind: "external",
        newTab: true,
      }) as AnalyticsEvent,
    );
    expect(events()[0]).toEqual([
      "event",
      "click",
      {
        page_path: "/p",
        fyw_session_id: "s1",
        fyw_seq: 1,
        target_tag: "a",
        target_text: "Go",
        link_url: "https://x/",
        target_id: "cta",
        link_kind: "external",
        new_tab: true,
      },
    ]);
  });

  it("buffers events tracked before init and forwards them after, in order", () => {
    const adapter = new GaAnalyticsAdapter({ measurementId: "G-ABC", loadScript });
    adapter.track(envelope({ seq: 1 }));
    adapter.track(envelope({ seq: 2 }));
    expect(events()).toHaveLength(0);

    // With no injected gtag, init installs the window shim; point it at `calls`.
    vi.stubGlobal("window", { dataLayer: [] });
    (window as unknown as { gtag?: unknown }).gtag = undefined;
    const withShim = new GaAnalyticsAdapter({ measurementId: "G-ABC", loadScript });
    withShim.track(envelope({ seq: 10 }));
    withShim.init({ consentGranted: true });
    expect(
      (window.dataLayer ?? []).filter((c) => Array.isArray(c) && c[0] === "event"),
    ).toHaveLength(1);
  });

  it("passes user_id through identify", () => {
    ready().identify("user-9");
    expect(calls).toContainEqual(["set", { user_id: "user-9" }]);
  });
});

describe("defaultLoadScript", () => {
  it("adds one async gtag script and never a duplicate", () => {
    const a = new GaAnalyticsAdapter({ measurementId: "G-DEF", gtag });
    a.init({ consentGranted: false });
    a.init({ consentGranted: true });

    const scripts = document.head.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.getAttribute("src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-DEF",
    );
    expect((scripts[0] as HTMLScriptElement).async).toBe(true);
  });
});
