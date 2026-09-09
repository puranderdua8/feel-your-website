import { describe, expect, it } from "vitest";

import { loadActionConfig } from "./action.js";

describe("loadActionConfig", () => {
  it("defaults to a no-op invoker with no env at all", () => {
    expect(loadActionConfig({})).toEqual({
      kind: "none",
      cache: "memory",
      rawBindings: {},
      hostAllowlist: [],
      firstPartyHosts: [],
    });
  });

  it("accepts the memory invoker without any http config", () => {
    expect(loadActionConfig({ ACTION_INVOKER: "memory" }).kind).toBe("memory");
  });

  it("rejects an unknown ACTION_INVOKER / ACTION_CACHE", () => {
    expect(() => loadActionConfig({ ACTION_INVOKER: "http-ish" })).toThrow(
      /Unknown ACTION_INVOKER/,
    );
    expect(() => loadActionConfig({ ACTION_CACHE: "redis" })).toThrow(/Unknown ACTION_CACHE/);
  });

  it("requires ACTION_CONFIG and ACTION_HOST_ALLOWLIST for the http invoker", () => {
    expect(() => loadActionConfig({ ACTION_INVOKER: "http" })).toThrow(/ACTION_CONFIG is required/);
    expect(() => loadActionConfig({ ACTION_INVOKER: "http", ACTION_CONFIG: "{}" })).toThrow(
      /ACTION_HOST_ALLOWLIST is required/,
    );
  });

  it("rejects non-JSON ACTION_CONFIG", () => {
    expect(() =>
      loadActionConfig({
        ACTION_INVOKER: "http",
        ACTION_CONFIG: "not json",
        ACTION_HOST_ALLOWLIST: "h",
      }),
    ).toThrow(/not valid JSON/);
  });

  it("parses the http config and splits the host lists", () => {
    const config = loadActionConfig({
      ACTION_INVOKER: "http",
      ACTION_CACHE: "blobs",
      ACTION_CONFIG: '{"feed.releases":{"urlTemplate":"https://api/x"}}',
      ACTION_HOST_ALLOWLIST: "api.example.com, other.example ",
      ACTION_FIRST_PARTY_HOSTS: "api.example.com",
    });

    expect(config.kind).toBe("http");
    expect(config.cache).toBe("blobs");
    expect(config.rawBindings).toEqual({ "feed.releases": { urlTemplate: "https://api/x" } });
    expect(config.hostAllowlist).toEqual(["api.example.com", "other.example"]);
    expect(config.firstPartyHosts).toEqual(["api.example.com"]);
  });
});
