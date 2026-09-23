import type { RouteBundle } from "@feel-your-website/content-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BootstrapPayload, RouteContent } from "@/server/bff";

import { refreshOfflineBootstrap, refreshOfflineRoute } from "./offline-refresh.js";

// jsdom has no `BroadcastChannel` of its own and Node's native one dispatches
// events its `Event`/`MessageEvent` classes don't recognise cross-realm — a
// test-environment mismatch only, not a real-browser one (a single-realm
// browser has no such split) — so this stubs the constructor to record what
// the module posts, instead of a real cross-instance round trip.
const postMessage = vi.fn();

vi.stubGlobal(
  "BroadcastChannel",
  class {
    postMessage = postMessage;
  },
);

afterEach(() => {
  postMessage.mockReset();
  Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
});

function stubController(): void {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { controller: {} },
    configurable: true,
  });
}

const content = (overrides: Partial<RouteContent> = {}): RouteContent => ({
  routeKey: "help",
  path: "/help",
  locale: "en",
  params: {},
  tree: [] as unknown as RouteBundle["tree"],
  hasOutlet: false,
  seo: { title: "Help — feel-your-website" },
  ...overrides,
});

const bootstrap = (overrides: Partial<BootstrapPayload> = {}): BootstrapPayload => ({
  locale: "en",
  messages: { "bootstrap.loading": "Loading…" },
  permissions: ["manage:things"],
  userId: "u1",
  degraded: false,
  nav: [{ id: "help", path: "/help", title: "Help", children: [] }],
  analytics: { provider: "none", measurementId: null, collectorPath: "", sampleRate: 1 },
  consent: "granted",
  ...overrides,
});

describe("refreshOfflineRoute", () => {
  it("broadcasts REFRESH_OFFLINE_ROUTE for a routeKey the build marks offline", () => {
    stubController();
    refreshOfflineRoute(content(), new Set(["help"]));

    expect(postMessage).toHaveBeenCalledWith({
      type: "REFRESH_OFFLINE_ROUTE",
      payload: {
        routeKey: "help",
        path: "/help",
        locale: "en",
        tree: [],
        seo: { title: "Help — feel-your-website" },
        hasOutlet: false,
      },
    });
  });

  it("does nothing for a routeKey the build does not mark offline", () => {
    stubController();
    refreshOfflineRoute(content({ routeKey: "blog" }), new Set(["help"]));
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("does nothing when there is no service worker controlling the page", () => {
    refreshOfflineRoute(content(), new Set(["help"]));
    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe("refreshOfflineBootstrap", () => {
  it("broadcasts only locale, messages and nav — never permissions, userId or consent", () => {
    stubController();
    refreshOfflineBootstrap(bootstrap());

    expect(postMessage).toHaveBeenCalledWith({
      type: "REFRESH_OFFLINE_BOOTSTRAP",
      payload: {
        locale: "en",
        messages: { "bootstrap.loading": "Loading…" },
        nav: [{ id: "help", path: "/help", title: "Help", children: [] }],
      },
    });
  });

  it("does nothing when there is no service worker controlling the page", () => {
    refreshOfflineBootstrap(bootstrap());
    expect(postMessage).not.toHaveBeenCalled();
  });
});
