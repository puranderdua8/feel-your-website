import type { ActionErrorCode } from "./types.js";

/**
 * Per-action wall-clock ceiling for a single upstream call. The section-data
 * aggregator enforces a smaller total budget on top of this.
 */
export const ACTION_TIMEOUT_MS = 3000;

/**
 * Thrown only for a genuinely exceptional condition — a misconfigured
 * catalog, a failed boot assertion. Expected outcomes (an upstream 404, a
 * timeout) are an `{ ok: false, code }` {@link import("./types.js").ActionResult},
 * not a throw.
 */
export class ActionError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = "ActionError";
    this.code = code;
  }
}

export function isActionError(value: unknown): value is ActionError {
  return value instanceof ActionError;
}
