import { describe, expect, it } from "vitest";

import { deriveSession, hashString, isSampled, SESSION_IDLE_MS } from "./session.js";

const freshId = () => "new-id";

describe("deriveSession", () => {
  it("starts a fresh session for a first-ever event", () => {
    const s = deriveSession({ previous: null, now: 1000, freshId });
    expect(s).toEqual({ id: "new-id", startedAt: 1000, lastSeenAt: 1000 });
  });

  it("slides the window forward within the idle limit, keeping id and startedAt", () => {
    const previous = { id: "keep", startedAt: 100, lastSeenAt: 1000 };
    const s = deriveSession({ previous, now: 1000 + SESSION_IDLE_MS - 1, freshId });
    expect(s).toEqual({ id: "keep", startedAt: 100, lastSeenAt: 1000 + SESSION_IDLE_MS - 1 });
  });

  it("starts a new session once the idle limit is reached", () => {
    const previous = { id: "old", startedAt: 100, lastSeenAt: 1000 };
    const s = deriveSession({ previous, now: 1000 + SESSION_IDLE_MS, freshId });
    expect(s).toEqual({
      id: "new-id",
      startedAt: 1000 + SESSION_IDLE_MS,
      lastSeenAt: 1000 + SESSION_IDLE_MS,
    });
  });
});

describe("hashString", () => {
  it("is deterministic and stays in uint32", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
    expect(hashString("anything")).toBeGreaterThanOrEqual(0);
    expect(hashString("anything")).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("isSampled", () => {
  it("everyone in at rate >= 1, no one at rate <= 0", () => {
    expect(isSampled("s", 1)).toBe(true);
    expect(isSampled("s", 2)).toBe(true);
    expect(isSampled("s", 0)).toBe(false);
    expect(isSampled("s", -1)).toBe(false);
    expect(isSampled("s", Number.NaN)).toBe(false);
  });

  it("is deterministic per session id", () => {
    const a = isSampled("session-a", 0.5);
    expect(isSampled("session-a", 0.5)).toBe(a);
  });

  it("roughly matches the rate across many ids", () => {
    let hits = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) if (isSampled(`id-${i}`, 0.25)) hits += 1;
    expect(hits / n).toBeGreaterThan(0.2);
    expect(hits / n).toBeLessThan(0.3);
  });
});
