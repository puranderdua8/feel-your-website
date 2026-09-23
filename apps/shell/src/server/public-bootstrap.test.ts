import { afterEach, describe, expect, it, vi } from "vitest";

import { resetAdapters } from "./adapters.js";

const savedAdapter = process.env.CONTENT_ADAPTER;

afterEach(() => {
  if (savedAdapter === undefined) delete process.env.CONTENT_ADAPTER;
  else process.env.CONTENT_ADAPTER = savedAdapter;
  resetAdapters();
  vi.doUnmock("./adapters.js");
  vi.resetModules();
});

describe("buildPublicBootstrap", () => {
  it("merges the CMS's messages over the bootstrap set and builds nav from known routes", async () => {
    process.env.CONTENT_ADAPTER = "memory";
    resetAdapters();
    const { buildPublicBootstrap } = await import("./public-bootstrap.js");

    const result = await buildPublicBootstrap("en");

    expect(result.degraded).toBe(false);
    // A key `contractSeed` sets for "en" reaches the merged set.
    expect(result.messages["bootstrap.retry"]).toBe("Try again");
    // A key only the bootstrap set has (contractSeed doesn't set it) survives the merge.
    expect(result.messages["bootstrap.error.title"]).toBe("Something went wrong");
    expect(result.nav.length).toBeGreaterThan(0);
  });

  it("degrades to the bootstrap message set and an empty nav when the CMS is unreachable", async () => {
    vi.doMock("./adapters.js", () => ({
      getContentAdapter: () => ({
        getMessages: () => Promise.reject(new Error("unreachable")),
        getRouteHeaders: () => Promise.reject(new Error("unreachable")),
      }),
    }));
    const { buildPublicBootstrap } = await import("./public-bootstrap.js");

    const result = await buildPublicBootstrap("en");

    expect(result.degraded).toBe(true);
    expect(result.nav).toEqual([]);
    expect(result.messages["bootstrap.loading"]).toBeDefined();
  });
});
