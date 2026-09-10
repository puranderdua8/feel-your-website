import { describe, expect, it } from "vitest";

import type { AnalyticsAdapter, AnalyticsEvent } from "./types.js";

/**
 * The behavioural contract every {@link AnalyticsAdapter} must satisfy. The
 * provider only stays vendor-agnostic if `NoopAnalyticsAdapter`, the memory
 * fake, and a real GA adapter agree on: no method ever throws, `init` is
 * safe to call more than once, and an event tracked before `init` is not lost.
 */

function sampleEvent(seq: number): AnalyticsEvent {
  return { type: "page", sessionId: "contract-session", seq, ts: seq * 1000, path: "/contract" };
}

export interface AnalyticsAdapterContractOptions {
  name: string;
  createAdapter: () => AnalyticsAdapter;
  /**
   * The events the adapter has delivered so far, in order. Omit for an adapter
   * with no observable surface (`NoopAnalyticsAdapter`) — only the "never
   * throws" guarantees are then checked.
   */
  delivered?: (adapter: AnalyticsAdapter) => readonly AnalyticsEvent[];
}

export function runAnalyticsAdapterContract(options: AnalyticsAdapterContractOptions): void {
  const { name, createAdapter, delivered } = options;

  describe(`AnalyticsAdapter contract: ${name}`, () => {
    it("never throws from init / identify / track, before or after init", () => {
      const adapter = createAdapter();
      expect(() => adapter.track(sampleEvent(1))).not.toThrow();
      expect(() => adapter.identify("u1")).not.toThrow();
      expect(() => adapter.init({ consentGranted: false })).not.toThrow();
      expect(() => adapter.init({ consentGranted: true })).not.toThrow(); // idempotent-safe
      expect(() => adapter.identify("u2")).not.toThrow();
      expect(() => adapter.track(sampleEvent(2))).not.toThrow();
    });

    if (delivered) {
      it("buffers an event tracked before init and delivers it after, in order", async () => {
        const adapter = createAdapter();
        adapter.track(sampleEvent(1));
        adapter.track(sampleEvent(2));
        expect(delivered(adapter)).toHaveLength(0);

        await adapter.init({ consentGranted: true });
        expect(delivered(adapter).map((e) => e.seq)).toEqual([1, 2]);
      });

      it("delivers an event tracked after init immediately, preserving order", async () => {
        const adapter = createAdapter();
        await adapter.init({ consentGranted: true });
        adapter.track(sampleEvent(1));
        adapter.track(sampleEvent(2));
        adapter.track(sampleEvent(3));
        expect(delivered(adapter).map((e) => e.seq)).toEqual([1, 2, 3]);
      });
    }
  });
}
