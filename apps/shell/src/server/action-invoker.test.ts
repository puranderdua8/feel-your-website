import { afterEach, describe, expect, it } from "vitest";

import { getActionInvoker, resetAdapters } from "./adapters.js";

const ACTION_VARS = [
  "ACTION_INVOKER",
  "ACTION_CACHE",
  "ACTION_CONFIG",
  "ACTION_HOST_ALLOWLIST",
  "ACTION_FIRST_PARTY_HOSTS",
] as const;

const saved = Object.fromEntries(ACTION_VARS.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of ACTION_VARS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  resetAdapters();
});

function withEnv(env: Partial<Record<(typeof ACTION_VARS)[number], string>>): void {
  for (const name of ACTION_VARS) delete process.env[name];
  for (const [name, value] of Object.entries(env)) process.env[name] = value;
  resetAdapters();
}

describe("getActionInvoker", () => {
  it("defaults to a not_found invoker when nothing is configured", async () => {
    withEnv({});
    await expect(getActionInvoker().invoke("feed.releases", {}, {})).resolves.toEqual({
      ok: false,
      code: "not_found",
    });
  });

  it("memoises, and rebuilds only after resetAdapters", () => {
    withEnv({});
    const first = getActionInvoker();
    expect(getActionInvoker()).toBe(first);
    resetAdapters();
    expect(getActionInvoker()).not.toBe(first);
  });

  it("binds the echoing memory invoker", async () => {
    withEnv({ ACTION_INVOKER: "memory" });
    await expect(getActionInvoker().invoke("anything", { a: 1 }, {})).resolves.toEqual({
      ok: true,
      data: { a: 1 },
    });
  });

  it("runs the binding assertion for the http invoker", () => {
    withEnv({
      ACTION_INVOKER: "http",
      ACTION_CONFIG: "{}",
      ACTION_HOST_ALLOWLIST: "api.example.com",
    });
    expect(() => getActionInvoker()).toThrow(/has no binding/);
  });

  it("uses the Netlify Blobs store for ACTION_CACHE=blobs", () => {
    withEnv({
      ACTION_INVOKER: "http",
      ACTION_CACHE: "blobs",
      ACTION_CONFIG: "{}",
      ACTION_HOST_ALLOWLIST: "api.example.com",
    });
    // No longer short-circuits with "not implemented" — it now constructs a
    // real Blobs-backed cache, which outside a Netlify runtime fails at
    // `getStore()`.
    expect(() => getActionInvoker()).toThrow(/Netlify Blobs/i);
  });
});
