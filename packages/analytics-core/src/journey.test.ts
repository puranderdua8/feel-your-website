import { describe, expect, it } from "vitest";

import { createJourneyCounter } from "./journey.js";

describe("createJourneyCounter", () => {
  it("counts from 1, monotonically, within a session", () => {
    const counter = createJourneyCounter();
    expect(counter.next("s1")).toBe(1);
    expect(counter.next("s1")).toBe(2);
    expect(counter.next("s1")).toBe(3);
  });

  it("restarts the count when the session id changes", () => {
    const counter = createJourneyCounter();
    counter.next("s1");
    counter.next("s1");
    expect(counter.next("s2")).toBe(1);
    expect(counter.next("s2")).toBe(2);
  });

  it("does not resume an old session's count when it comes back", () => {
    const counter = createJourneyCounter();
    counter.next("s1"); // 1
    counter.next("s2"); // 1
    expect(counter.next("s1")).toBe(1);
  });

  it("keeps independent counters independent", () => {
    const a = createJourneyCounter();
    const b = createJourneyCounter();
    a.next("s");
    a.next("s");
    expect(b.next("s")).toBe(1);
  });
});
