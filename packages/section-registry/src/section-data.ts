import type { JsonValue } from "@feel-your-website/content-core";

import type { RouteRenderContext } from "./context.js";

/**
 * A resolved query-action call: the action id plus the request body already
 * built from this section's authored fields and route params. Query inputs
 * are `static` / `routeParam` only, so a section's own `deriveInvocation`
 * code can produce the body directly — no author-configured mapping and no
 * server-side re-derivation are needed (unlike a mutation CTA).
 */
export interface QueryInvocation {
  readonly actionId: string;
  readonly body: Readonly<Record<string, JsonValue>>;
}

/**
 * How a section type declares its external-data need. Pure and SSR-safe: it
 * describes the call and shapes the result, but never performs the call.
 */
export interface SectionQuerySpec<TParsed = unknown> {
  /**
   * Build the query invocation from this instance's authored fields and the
   * route it renders on. Return `null` when the instance needs no data (e.g.
   * an unfilled source field).
   */
  deriveInvocation(
    fields: Readonly<Record<string, JsonValue>>,
    route: RouteRenderContext | undefined,
  ): QueryInvocation | null;
  /**
   * Narrow the (already structurally-parsed) result to exactly what the
   * component renders. `null` rejects the payload. Runs per instance.
   */
  project?(result: JsonValue): TParsed | null;
  /** Stand-in data for the CMS preview, which makes no real call. */
  previewSample?: JsonValue;
  /**
   * `false` → this section is left out of the SSR wait; it renders a skeleton
   * and fetches on the client. Default `true`.
   */
  blocking?: boolean;
}

/**
 * `sectionKey` → its query spec. Empty until a data-backed section is
 * registered alongside its component in `registry.tsx`.
 */
export const SECTION_QUERY_REGISTRY: Readonly<Record<string, SectionQuerySpec>> = {};
