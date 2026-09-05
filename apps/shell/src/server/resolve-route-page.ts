import {
  buildHref,
  interpolateSeo,
  interpolateTemplate,
  matchRoute,
  normalizeRequestPath,
  parseRoutePattern,
  resolveParentChain,
  type RouteBundle,
  type RouteSectionNode,
  type RouteSeo,
} from "@feel-your-website/content-core";

import { isReservedPath } from "@/reserved-paths.js";

/** One level of a nested route's render stack, outermost (root) first. */
export interface RouteLayer {
  bundleId: string;
  /** This layer's section tree; a parent layer carries an `outlet` node. */
  tree: readonly RouteSectionNode[];
}

/** One entry in the breadcrumb chain, root-first, current route last. */
export interface RouteChainEntry {
  id: string;
  /** Absolute pattern, e.g. `/blog/:slug`. */
  path: string;
  /** The concrete URL for this entry, params filled in from the matched route. */
  href: string;
  /** Display label — the interpolated SEO title, else the last path segment. */
  title: string;
}

export interface RoutePage {
  /** The concrete, normalised pathname that matched. */
  pathname: string;
  /** The negotiated locale — which of each node's content bags to render. */
  locale: string;
  /** `:name` segment values, decoded and sanitised. `{}` for a static route. */
  params: Record<string, string>;
  /** The matched route's absolute pattern. */
  pattern: string;
  /** Breadcrumb chain, root-first, current route last. */
  chain: RouteChainEntry[];
  /**
   * The render stack, outermost first: a parent layout wraps the next layer via
   * its `outlet` node, down to the matched route. One entry for a top-level
   * route. Every node carries its own per-locale content — nothing else to
   * fetch; see `@feel-your-website/section-registry`'s `renderComposition`.
   */
  layers: RouteLayer[];
  /** The matched route's SEO for `locale`, with `{{param}}` already interpolated. `{}` when it has none. */
  seo: RouteSeo;
}

/**
 * A route param is a raw URL segment. `normalizeRequestPath` has already decoded
 * it; reject anything that could smuggle structure into a downstream string
 * (path separators, C0/DEL control characters) or is absurdly long. A rejected
 * value fails the whole match — the visitor gets `notFound()`, not a section
 * quietly handed a hostile string.
 */
export function sanitizeParam(value: string): string | null {
  if (value.length === 0 || value.length > 1024) return null;
  // A bare dot segment is a traversal token, not a slug.
  if (value === "." || value === "..") return null;
  // `normalizeRequestPath` leaves a segment percent-encoded only when decoding
  // it would introduce a `/`; a surviving `%` therefore means a smuggled
  // separator.
  if (value.includes("%")) return null;
  // Path separators (/ and \\), whitespace, and C0/DEL control characters —
  // never legitimate in one decoded path segment. Slug punctuation (- _ .)
  // and Unicode letters pass.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 32 || code === 127 || code === 47 || code === 92) return null;
  }
  return value;
}

/**
 * A breadcrumb label for a route whose SEO title is unset (or interpolates to
 * empty): the pattern's last segment — but resolved to the request's actual
 * value when that segment is a `:param`, never the raw `:name` token, which no
 * visitor could read. `/` falls back to `"home"`.
 */
function fallbackTitle(pattern: string, params: Readonly<Record<string, string>>): string {
  try {
    const last = parseRoutePattern(pattern).segments.at(-1);
    if (!last) return "home";
    return last.kind === "param" ? params[last.value] || last.value : last.value;
  } catch {
    return "home";
  }
}

/**
 * The pure core of `loadRoutePage`: match `rawPath` against the published
 * manifest, walk the parent chain, sanitise params, interpolate SEO. Returns
 * `null` for no match, a reserved path, or a hostile param.
 */
export function resolveRoutePage(
  rawPath: string,
  manifest: readonly RouteBundle[],
  locale: string,
): RoutePage | null {
  // The one place request-path canonicalisation lives — trailing slashes,
  // `//`, percent-decoding. `stripLocaleSegment` stays unset while locale rides
  // on a cookie; wiring URL-locale is a change here, not at every call site.
  const { pathname } = normalizeRequestPath(rawPath);
  if (isReservedPath(pathname)) return null;

  const match = matchRoute(
    pathname,
    manifest.map((bundle) => ({ pattern: bundle.path, value: bundle })),
  );
  if (!match) return null;

  const params: Record<string, string> = {};
  for (const [name, raw] of Object.entries(match.params)) {
    const clean = sanitizeParam(raw);
    if (clean === null) return null;
    params[name] = clean;
  }

  const byId = new Map<string, RouteBundle>(manifest.map((bundle) => [bundle.id, bundle]));
  const chainBundles = resolveParentChain(match.value, byId);

  const layers: RouteLayer[] = chainBundles.map((bundle) => ({
    bundleId: bundle.id,
    tree: bundle.tree,
  }));

  const chain: RouteChainEntry[] = chainBundles.map((bundle) => {
    const interpolated = interpolateTemplate(bundle.seo[locale]?.title ?? "", params).value.trim();
    return {
      id: bundle.id,
      path: bundle.path,
      // Every ancestor's `:name` segments are a prefix of the matched pattern's,
      // so `params` covers them.
      href: buildHref(bundle.path, params),
      title: interpolated || fallbackTitle(bundle.path, params),
    };
  });

  return {
    pathname,
    locale,
    params,
    pattern: match.pattern,
    chain,
    layers,
    seo: interpolateSeo(match.value.seo[locale] ?? {}, params),
  };
}
