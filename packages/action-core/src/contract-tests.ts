import { describe, expect, it } from "vitest";

import type { ActionInvoker } from "./ActionInvoker.js";

/**
 * The behavioural contract every {@link ActionInvoker} must satisfy — the
 * query/mutation layer is only substitutable if `MemoryActionInvoker` and the
 * HTTP invoker agree on how a call resolves, how an unknown id is reported,
 * and what a failure result may contain.
 *
 * Caching behaviour (a query honouring its TTL, a mutation never cached) is a
 * property of the cache decorator, tested where that lives — not here.
 */

export const ACTION_CONTRACT_FIXTURE = {
  /** An action id the invoker under test resolves to some data. */
  knownId: "contract.known",
  /** An action id the invoker under test does not know. */
  unknownId: "contract.unknown",
} as const;

/** The only keys an `ActionResult` may carry — a failure must not leak upstream text. */
const RESULT_KEYS = new Set(["ok", "code", "data", "stale", "issues"]);

export interface ActionInvokerContractOptions {
  name: string;
  /** An invoker where `ACTION_CONTRACT_FIXTURE.knownId` resolves. */
  createInvoker: () => Promise<ActionInvoker> | ActionInvoker;
  /** An invoker where every call fails as if the upstream were unreachable. */
  createUnavailableInvoker?: () => Promise<ActionInvoker> | ActionInvoker;
}

export function runActionInvokerContract(options: ActionInvokerContractOptions): void {
  const { name, createInvoker, createUnavailableInvoker } = options;
  const f = ACTION_CONTRACT_FIXTURE;

  describe(`ActionInvoker contract: ${name}`, () => {
    it("resolves a known action to ok:true with JSON-serialisable data", async () => {
      const invoker = await createInvoker();
      const result = await invoker.invoke(f.knownId, {}, {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(JSON.parse(JSON.stringify(result.data)));
      }
    });

    it("returns not_found for an unknown id without throwing", async () => {
      const invoker = await createInvoker();
      await expect(invoker.invoke(f.unknownId, {}, {})).resolves.toEqual({
        ok: false,
        code: "not_found",
      });
    });

    it("never carries a non-contract key on a result", async () => {
      const invoker = await createInvoker();
      for (const id of [f.knownId, f.unknownId]) {
        const result = await invoker.invoke(id, {}, {});
        for (const key of Object.keys(result)) {
          expect(RESULT_KEYS.has(key), `unexpected result key "${key}"`).toBe(true);
        }
      }
    });

    if (createUnavailableInvoker) {
      it("reports an unreachable upstream as ok:false with a code and no vendor text", async () => {
        const invoker = await createUnavailableInvoker();
        const result = await invoker.invoke(f.knownId, {}, {});

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(["unavailable", "timeout", "rate_limited"]).toContain(result.code);
        }
        for (const key of Object.keys(result)) {
          expect(RESULT_KEYS.has(key), `unexpected result key "${key}"`).toBe(true);
        }
      });
    }
  });
}
