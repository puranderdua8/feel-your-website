import { describe, expect, it } from "vitest";

import { canonicalPathname, offlineBootstrapPayload } from "./__root.js";

describe("canonicalPathname", () => {
  it("strips a trailing slash", () => {
    expect(canonicalPathname("/blog/")).toBe("/blog");
  });

  it("leaves root alone", () => {
    expect(canonicalPathname("/")).toBe("/");
  });

  it("collapses doubled slashes", () => {
    expect(canonicalPathname("//blog//hello-world")).toBe("/blog/hello-world");
  });

  it("collapses doubled slashes and strips a trailing slash together", () => {
    expect(canonicalPathname("/blog//hello-world/")).toBe("/blog/hello-world");
  });

  it("leaves an already-canonical path alone", () => {
    expect(canonicalPathname("/blog/hello-world")).toBe("/blog/hello-world");
  });

  it("leaves case alone — an uppercase segment is a matching concern, not a redirect one", () => {
    expect(canonicalPathname("/Blog/")).toBe("/Blog");
  });
});

describe("offlineBootstrapPayload", () => {
  it("builds an anonymous, degraded payload from the given locale, messages and nav", () => {
    const nav = [{ id: "help", path: "/help", title: "Help", children: [] }];
    const result = offlineBootstrapPayload("en", { "bootstrap.loading": "Loading…" }, nav);

    expect(result).toEqual({
      locale: "en",
      messages: { "bootstrap.loading": "Loading…" },
      permissions: [],
      userId: null,
      degraded: true,
      nav,
      analytics: { provider: "none", measurementId: null, collectorPath: "", sampleRate: 1 },
      consent: "unknown",
    });
  });
});
