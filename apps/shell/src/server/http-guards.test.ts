import { describe, expect, it } from "vitest";

import { isSameOrigin } from "./http-guards.js";

describe("isSameOrigin", () => {
  it("trusts Sec-Fetch-Site when present", () => {
    expect(isSameOrigin({ secFetchSite: "same-origin" })).toBe(true);
    expect(isSameOrigin({ secFetchSite: "none" })).toBe(true);
    expect(isSameOrigin({ secFetchSite: "SAME-ORIGIN" })).toBe(true);
    expect(isSameOrigin({ secFetchSite: "same-site" })).toBe(false);
    expect(isSameOrigin({ secFetchSite: "cross-site" })).toBe(false);
  });

  it("ignores Origin/Referer once Sec-Fetch-Site has spoken", () => {
    expect(
      isSameOrigin({
        secFetchSite: "cross-site",
        origin: "https://app.example",
        host: "app.example",
      }),
    ).toBe(false);
  });

  it("falls back to Origin host vs Host", () => {
    expect(isSameOrigin({ origin: "https://app.example", host: "app.example" })).toBe(true);
    expect(isSameOrigin({ origin: "http://localhost:3000", host: "localhost:3000" })).toBe(true);
    expect(isSameOrigin({ origin: "https://evil.example", host: "app.example" })).toBe(false);
  });

  it("falls back to the Referer origin when there is no Origin", () => {
    expect(
      isSameOrigin({ referer: "https://app.example/some/page?x=1", host: "app.example" }),
    ).toBe(true);
    expect(isSameOrigin({ referer: "https://evil.example/x", host: "app.example" })).toBe(false);
  });

  it("refuses when nothing identifies the origin", () => {
    expect(isSameOrigin({})).toBe(false);
    expect(isSameOrigin({ host: "app.example" })).toBe(false);
    expect(isSameOrigin({ origin: "not a url", host: "app.example" })).toBe(false);
    expect(isSameOrigin({ origin: "https://app.example" })).toBe(false);
  });
});
