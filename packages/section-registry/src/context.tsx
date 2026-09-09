import type { Locale } from "@feel-your-website/content-core";
import { createContext, useContext } from "react";

/**
 * Re-exported from `@feel-your-website/content-core`, which now owns it (a
 * content-model fact adapters need too). Kept exported from here so existing
 * `import { OUTLET_SECTION_KEY } from "@feel-your-website/section-registry"`
 * call sites are unchanged.
 */
export { OUTLET_SECTION_KEY } from "@feel-your-website/content-core";

/**
 * What a section knows about the route it is being rendered on.
 *
 * Threaded by {@link renderComposition} and exposed both as an optional
 * `route` prop on every section component and via the hooks below, so a section
 * deep inside a slot can still read it without prop-drilling.
 *
 * `params` are raw URL path segments. **Treat them as untrusted input** — the
 * shell decodes and length-checks them before they get here, but a section that
 * feeds a value into `dangerouslySetInnerHTML`, a fetch URL, or a query string
 * must escape it exactly as it would any other external string.
 */
export interface RouteRenderContext {
  /** `:name` segment values from the matched pattern. `{}` for a static route. */
  readonly params: Readonly<Record<string, string>>;
  /** The concrete pathname being rendered, already normalised. */
  readonly pathname: string;
  /** The matched route's absolute pattern, e.g. `/blog/:slug`. */
  readonly pattern: string;
  /** Root-first, including the current route last — for breadcrumbs. */
  readonly chain: readonly RouteChainEntry[];
  /** Which of each node's per-locale content bags is being rendered. */
  readonly locale: Locale;
}

/** One route in {@link RouteRenderContext.chain}. */
export interface RouteChainEntry {
  readonly id: string;
  /** Absolute pattern. */
  readonly path: string;
  /** Display label — an interpolated SEO title, or the last path segment. */
  readonly title: string;
}

const RouteRenderCtx = createContext<RouteRenderContext | null>(null);

export const RouteRenderProvider = RouteRenderCtx.Provider;

/** The full render context, or `null` when rendered outside a route (e.g. the CMS section gallery). */
export function useRouteRenderContext(): RouteRenderContext | null {
  return useContext(RouteRenderCtx);
}

/** Just the route params — `{}` when outside a route. */
export function useRouteParams(): Readonly<Record<string, string>> {
  return useContext(RouteRenderCtx)?.params ?? {};
}

/** One route param by name, or `undefined`. The encouraged accessor. */
export function useRouteParam(name: string): string | undefined {
  return useContext(RouteRenderCtx)?.params[name];
}
