import type { JsonValue } from "@feel-your-website/content-core";

import type { ActionInvoker } from "./ActionInvoker.js";
import type { ActionErrorCode, ActionResult } from "./types.js";

/** A seed value for an action id: fixed data, or a function of the request body. */
export type MemoryActionSeed = Readonly<
  Record<string, JsonValue | ((body: Readonly<Record<string, JsonValue>>) => JsonValue)>
>;

export interface MemoryActionInvokerOptions {
  /** Data (or a body → data function) per action id. */
  readonly seed?: MemoryActionSeed;
  /**
   * Force every invoke to fail with this code, as if the upstream were
   * unreachable. For exercising the failure path.
   */
  readonly failWith?: ActionErrorCode;
  /**
   * When an id is not in `seed`, return the request body as the result
   * instead of `not_found`. Off by default (so the contract's unknown-id
   * case holds); the CMS turns it on for a dry-run preview.
   */
  readonly echoUnseeded?: boolean;
}

/**
 * An {@link ActionInvoker} backed by an in-memory seed. Used by tests and by
 * the CMS preview — never by the shell against a real upstream.
 */
export class MemoryActionInvoker implements ActionInvoker {
  readonly #seed: MemoryActionSeed;
  readonly #failWith?: ActionErrorCode;
  readonly #echoUnseeded: boolean;

  constructor(options: MemoryActionInvokerOptions = {}) {
    this.#seed = options.seed ?? {};
    this.#failWith = options.failWith;
    this.#echoUnseeded = options.echoUnseeded ?? false;
  }

  invoke(actionId: string, body: Readonly<Record<string, JsonValue>>): Promise<ActionResult> {
    if (this.#failWith) {
      return Promise.resolve({ ok: false, code: this.#failWith });
    }

    const entry = this.#seed[actionId];
    if (entry !== undefined) {
      const data = typeof entry === "function" ? entry(body) : entry;
      return Promise.resolve({ ok: true, data });
    }

    if (this.#echoUnseeded) {
      return Promise.resolve({ ok: true, data: body });
    }

    return Promise.resolve({ ok: false, code: "not_found" });
  }
}
