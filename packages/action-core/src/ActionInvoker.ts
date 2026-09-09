import type { JsonValue } from "@feel-your-website/content-core";

import type { ActionResult } from "./types.js";

/** Request-scoped context an invoker may draw on. */
export interface ActionContext {
  /** Opaque id of the signed-in user, or `null`. */
  readonly userId?: string | null;
  /** The caller's per-submit id, forwarded upstream when the action is idempotent. */
  readonly requestId?: string;
  /** The caller's session token, forwarded upstream only when the binding opts in. */
  readonly userToken?: string;
  /** Aborts the upstream call when the caller's time budget is spent. */
  readonly signal?: AbortSignal;
}

/**
 * Executes one catalog action against its configured upstream and returns a
 * normalised {@link ActionResult}.
 *
 * `body` is the already-built, already-validated input map (the shell BFF
 * derives it from published content + re-sanitised route params — never from
 * the client). The invoker only places it in the request per the action's
 * binding, applies the timeout, and normalises the response. It does not
 * throw for an expected failure.
 */
export interface ActionInvoker {
  invoke(
    actionId: string,
    body: Readonly<Record<string, JsonValue>>,
    context: ActionContext,
  ): Promise<ActionResult>;
}
