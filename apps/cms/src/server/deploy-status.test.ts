import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchDeployStatus, pendingRouteKeys } from "./deploy-status.js";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDeployStatus", () => {
  it("returns null when no base URL is configured", async () => {
    expect(await fetchDeployStatus(undefined)).toBeNull();
  });

  it("fetches /build-info.json against the given base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        snapshotHash: "abc123",
        builtAt: "2026-01-01T00:00:00.000Z",
        routes: [
          { routeKey: "help", path: "/help" },
          { routeKey: "blog", path: "/blog" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const status = await fetchDeployStatus("https://example.com");

    expect(fetchMock).toHaveBeenCalledWith(new URL("https://example.com/build-info.json"), {
      signal: expect.any(AbortSignal),
    });
    expect(status).toEqual({
      snapshotHash: "abc123",
      builtAt: "2026-01-01T00:00:00.000Z",
      routeKeys: ["help", "blog"],
      routePaths: ["/help", "/blog"],
    });
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false)));
    expect(await fetchDeployStatus("https://example.com")).toBeNull();
  });

  it("returns null when the response body doesn't parse as build-info", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ not: "build-info" })));
    expect(await fetchDeployStatus("https://example.com")).toBeNull();
  });

  it("returns null when the request throws (unreachable deploy)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    expect(await fetchDeployStatus("https://example.com")).toBeNull();
  });

  it("drops malformed route entries but keeps the well-formed ones", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          snapshotHash: "abc123",
          builtAt: "2026-01-01T00:00:00.000Z",
          routes: [{ routeKey: "help" }, { path: "/no-key" }, "garbage", null],
        }),
      ),
    );
    const status = await fetchDeployStatus("https://example.com");
    expect(status?.routeKeys).toEqual(["help"]);
    expect(status?.routePaths).toEqual(["/no-key"]);
  });
});

describe("pendingRouteKeys", () => {
  const compositions = [
    { routeKey: "help", published: true },
    { routeKey: "blog", published: true },
    { routeKey: "draft-route", published: false },
  ];

  it("returns an empty set when there's no deploy status", () => {
    expect(pendingRouteKeys(compositions, null).size).toBe(0);
  });

  it("flags a published route missing from the deployed manifest", () => {
    const status = { snapshotHash: "h", builtAt: "t", routeKeys: ["help"], routePaths: [] };
    expect(pendingRouteKeys(compositions, status)).toEqual(new Set(["blog"]));
  });

  it("never flags an unpublished (draft) route", () => {
    const status = { snapshotHash: "h", builtAt: "t", routeKeys: ["help", "blog"], routePaths: [] };
    expect(pendingRouteKeys(compositions, status).has("draft-route")).toBe(false);
  });

  it("flags nothing once the deployed manifest has caught up", () => {
    const status = { snapshotHash: "h", builtAt: "t", routeKeys: ["help", "blog"], routePaths: [] };
    expect(pendingRouteKeys(compositions, status).size).toBe(0);
  });
});
