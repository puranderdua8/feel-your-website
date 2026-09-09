import { defineActions } from "@feel-your-website/action-core";
import { describe, expect, it } from "vitest";

import { assertBindings, parseHttpActionBindings, type HttpActionBindings } from "./bindings.js";

const catalog = defineActions([
  {
    id: "feed.releases",
    kind: "query",
    method: "GET",
    description: "Releases.",
    input: [{ name: "limit", label: "Limit", type: "number" }],
    allowedSources: ["static"],
  },
  {
    id: "newsletter.subscribe",
    kind: "mutation",
    method: "POST",
    description: "Subscribe.",
    input: [{ name: "email", label: "Email", type: "text", required: true }],
    allowedSources: ["static"],
  },
]);

const bindings: HttpActionBindings = {
  "feed.releases": {
    urlTemplate: "https://api.example.com/releases",
    method: "GET",
    allowedParams: ["limit"],
    allowedHost: "api.example.com",
  },
  "newsletter.subscribe": {
    urlTemplate: "https://api.example.com/subscribe",
    method: "POST",
    allowedParams: ["email"],
    allowedHost: "api.example.com",
  },
};

describe("parseHttpActionBindings", () => {
  it("parses a well-formed blob and upper-cases the method", () => {
    const parsed = parseHttpActionBindings({
      "x.y": {
        urlTemplate: "https://h/x",
        method: "post",
        allowedParams: ["a"],
        allowedHost: "h",
        headersFromEnv: { Authorization: "TOKEN" },
      },
    });
    expect(parsed["x.y"]?.method).toBe("POST");
    expect(parsed["x.y"]?.headersFromEnv).toEqual({ Authorization: "TOKEN" });
  });

  it("throws on a missing urlTemplate", () => {
    expect(() => parseHttpActionBindings({ "x.y": { method: "GET", allowedHost: "h" } })).toThrow(
      /urlTemplate must be a non-empty string/,
    );
  });

  it("throws on a bad apply value", () => {
    expect(() =>
      parseHttpActionBindings({
        "x.y": { urlTemplate: "https://h/x", method: "GET", allowedHost: "h", apply: "headers" },
      }),
    ).toThrow(/apply must be/);
  });
});

describe("assertBindings", () => {
  const ctx = { hostAllowlist: ["api.example.com"] };

  it("passes a matching set", () => {
    expect(() => assertBindings(catalog, bindings, ctx)).not.toThrow();
  });

  it("throws when a catalog action has no binding", () => {
    const partial = Object.fromEntries(
      Object.entries(bindings).filter(([id]) => id !== "newsletter.subscribe"),
    );
    expect(() => assertBindings(catalog, partial, ctx)).toThrow(
      /"newsletter.subscribe" has no binding/,
    );
  });

  it("throws when a binding names no catalog action", () => {
    expect(() =>
      assertBindings(catalog, { ...bindings, "ghost.x": bindings["feed.releases"]! }, ctx),
    ).toThrow(/"ghost.x" names no action/);
  });

  it("throws when the method disagrees with the action", () => {
    const bad = { ...bindings, "feed.releases": { ...bindings["feed.releases"]!, method: "POST" } };
    expect(() => assertBindings(catalog, bad, ctx)).toThrow(
      /method is POST but the action's method is GET/,
    );
  });

  it("throws when the host is not allow-listed", () => {
    expect(() => assertBindings(catalog, bindings, { hostAllowlist: ["other.example"] })).toThrow(
      /is not in the action host allowlist/,
    );
  });

  it("throws when the URL host does not match allowedHost", () => {
    const bad = {
      ...bindings,
      "feed.releases": { ...bindings["feed.releases"]!, allowedHost: "elsewhere.example" },
    };
    expect(() => assertBindings(catalog, bad, ctx)).toThrow(/does not match allowedHost/);
  });

  it("throws when forwardUserAuth targets a non-first-party host", () => {
    const bad = {
      ...bindings,
      "feed.releases": { ...bindings["feed.releases"]!, forwardUserAuth: true },
    };
    expect(() => assertBindings(catalog, bad, ctx)).toThrow(/not a first-party host/);
    expect(() =>
      assertBindings(catalog, bad, { ...ctx, firstPartyHosts: ["api.example.com"] }),
    ).not.toThrow();
  });

  it("throws when a headersFromEnv var is unset", () => {
    const bad = {
      ...bindings,
      "feed.releases": {
        ...bindings["feed.releases"]!,
        headersFromEnv: { Authorization: "MISSING_TOKEN" },
      },
    };
    expect(() => assertBindings(catalog, bad, { ...ctx, readEnv: () => undefined })).toThrow(
      /reads MISSING_TOKEN, which is not set/,
    );
    expect(() => assertBindings(catalog, bad, { ...ctx, readEnv: () => "secret" })).not.toThrow();
  });
});
