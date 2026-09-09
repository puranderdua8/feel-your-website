import type { FieldIssue, JsonValue, SectionFieldSpec } from "@feel-your-website/content-core";

/**
 * A registered action is one entry in a closed, code-defined catalog of
 * pre-approved external HTTP endpoints. A section references a `query` action
 * to pull data into its render; a CTA references a `mutation` action that
 * fires on click. The upstream URL, headers and secrets are never here — they
 * live in the concrete invoker's env-driven bindings.
 *
 * `ActionDefinition` is a discriminated union rather than one shape with a
 * `kind` field so that `cache` / `idempotent` / `confirm` are only valid
 * where they mean something. `defineActions` re-checks the little that types
 * cannot (method ⇔ kind).
 */

export type ActionKind = "query" | "mutation";

/** Where a mapped input value comes from. `formInput` is mutation-only. */
export type ActionInputSource = "static" | "routeParam" | "formInput";

/** An action input: the same shape as a section field, so the CMS renders a real form for it. */
export type ActionInputSpec = SectionFieldSpec;

/**
 * How each of an action's inputs is filled, authored in the CMS and keyed by
 * input name. `static` → a literal; `routeParam` → a route param name;
 * `formInput` → a form field name.
 */
export type ActionInputMapping = Readonly<
  Record<string, { readonly source: ActionInputSource; readonly value: string }>
>;

/** A section's / CTA's reference to a catalog action, with its input mapping. */
export interface ActionInvocation {
  readonly actionId: string;
  readonly input: ActionInputMapping;
}

interface ActionDefinitionBase<TResult> {
  /** Closed vocabulary — indexes the catalog and the invoker's bindings, never a URL. */
  readonly id: string;
  readonly description: string;
  /** Input schema — reuses `SectionFieldSpec`, so the CMS form is auto-rendered. */
  readonly input: readonly ActionInputSpec[];
  readonly allowedSources: readonly ActionInputSource[];
  /** When set, the caller must hold this permission for the invoke to proceed. */
  readonly requiredPermission?: string;
  /** Narrows the upstream response to a known shape, or returns `null` to reject it. */
  readonly parseResult?: (raw: JsonValue) => TResult | null;
}

export interface QueryActionDefinition<TResult = JsonValue> extends ActionDefinitionBase<TResult> {
  readonly kind: "query";
  readonly method: "GET" | "HEAD";
  /** Response caching. Only meaningful — and only permitted — on a query. */
  readonly cache?: {
    readonly ttlMs: number;
    readonly swr?: boolean;
    readonly negativeTtlMs?: number;
  };
}

export interface MutationActionDefinition<
  TResult = JsonValue,
> extends ActionDefinitionBase<TResult> {
  readonly kind: "mutation";
  readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Forward the caller's `requestId` upstream as an idempotency key. */
  readonly idempotent?: boolean;
  /** Ask the user to confirm before firing (CTA only). */
  readonly confirm?: boolean;
}

export type ActionDefinition<TResult = JsonValue> =
  QueryActionDefinition<TResult> | MutationActionDefinition<TResult>;

export type ActionErrorCode =
  | "invalid_request"
  | "forbidden"
  | "not_found"
  | "unavailable"
  | "timeout"
  | "rate_limited"
  | "invalid_response";

/**
 * The normalised outcome of an invoke. Expected failures (an upstream 404, a
 * timeout, a validation problem) are an `ok: false` result — not a thrown
 * error — and never carry upstream response text.
 */
export type ActionResult<T = JsonValue> =
  | { readonly ok: true; readonly data: T; readonly stale?: boolean }
  | {
      readonly ok: false;
      readonly code: ActionErrorCode;
      readonly issues?: readonly FieldIssue[];
    };
