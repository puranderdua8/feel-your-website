/**
 * Route path patterns: parsing, precedence matching, hierarchy, and templating.
 *
 * One pure module, no vendor and no vitest imports, shared by every adapter and
 * by `apps/shell`. It exists so that "which route does this URL resolve to" has
 * exactly one implementation — the memory adapter, the Supabase adapter and the
 * shell all call the functions here rather than each rolling their own string
 * comparison.
 *
 * A "pattern" is an absolute path that may contain `:name` segments, e.g.
 * `/blog/:slug` or `/docs/:category/:page`. Precedence between patterns that
 * could both match a URL is decided *structurally* by {@link matchRoute}: a
 * static segment always beats a `:param` segment at the same position, and the
 * matcher backtracks, so the outcome is a property of the traversal order rather
 * than a similarity score.
 */

import type { RouteParamMeta, RouteSeo } from "./types.js";

/** A single `:name` in a pattern must look like a safe identifier. */
const PARAM_NAME_RE = /^[a-z][a-zA-Z0-9_]*$/;

/** `{{ name }}` — the SEO-template placeholder. Whitespace-tolerant. */
const PLACEHOLDER_RE = /\{\{\s*([a-z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Thrown for a malformed pattern or a missing interpolation argument. */
export class RoutePatternError extends Error {
  /** The offending pattern / segment, for the CMS to echo back. */
  readonly input: string;

  constructor(message: string, input: string) {
    super(`${message} (in "${input}")`);
    this.name = "RoutePatternError";
    this.input = input;
  }
}

/**
 * Thrown by {@link buildRouteTrie} when two patterns are identical once param
 * names are ignored (`/blog/:slug` vs `/blog/:id`) — they match the same set of
 * URLs, so one would be permanently unreachable. The database's
 * `unique (normalized_path)` constraint is the real guard; this is
 * defence-in-depth at assembly time.
 */
export class RoutePatternCollisionError extends Error {
  readonly patterns: readonly [string, string];

  constructor(a: string, b: string) {
    super(`Route patterns "${a}" and "${b}" match the same set of paths.`);
    this.name = "RoutePatternCollisionError";
    this.patterns = [a, b];
  }
}

export function isRoutePatternError(error: unknown): error is RoutePatternError {
  return error instanceof RoutePatternError;
}

// --- Parsing ----------------------------------------------------------------

export interface PatternSegment {
  readonly kind: "static" | "param";
  /** For `static`, the literal (percent-decoded); for `param`, the bare name. */
  readonly value: string;
}

export interface RoutePattern {
  /** The pattern exactly as given — already canonical if parsing succeeded. */
  readonly raw: string;
  readonly segments: readonly PatternSegment[];
  /** `:name` parameters, in order of appearance. */
  readonly paramNames: readonly string[];
}

/**
 * Parses an absolute pattern, throwing {@link RoutePatternError} on anything
 * malformed: not starting with `/`, an empty segment (`//`), a trailing slash, a
 * bare `:`, a `:name` that is not a safe identifier, a `:` inside a static
 * segment, or a repeated param name.
 *
 * `"/"` is the root pattern and parses to zero segments.
 */
export function parseRoutePattern(raw: string): RoutePattern {
  if (typeof raw !== "string" || !raw.startsWith("/")) {
    throw new RoutePatternError("a pattern must be an absolute path starting with '/'", String(raw));
  }
  if (raw === "/") return Object.freeze({ raw, segments: [], paramNames: [] });
  if (raw.endsWith("/")) {
    throw new RoutePatternError("a pattern must not end with '/'", raw);
  }

  const rawSegments = raw.slice(1).split("/");
  const segments: PatternSegment[] = [];
  const paramNames: string[] = [];

  for (const seg of rawSegments) {
    if (seg === "") {
      throw new RoutePatternError("a pattern must not contain an empty segment", raw);
    }

    if (seg.startsWith(":")) {
      const name = seg.slice(1);
      if (!PARAM_NAME_RE.test(name)) {
        throw new RoutePatternError(
          `":${name}" is not a valid parameter name (must match ${PARAM_NAME_RE.source})`,
          raw,
        );
      }
      if (paramNames.includes(name)) {
        throw new RoutePatternError(`parameter ":${name}" appears more than once`, raw);
      }
      paramNames.push(name);
      segments.push({ kind: "param", value: name });
      continue;
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      throw new RoutePatternError(`segment "${seg}" is not valid percent-encoding`, raw);
    }
    if (decoded.includes("/")) {
      throw new RoutePatternError(`segment "${seg}" decodes to contain '/'`, raw);
    }
    if (decoded.includes(":")) {
      throw new RoutePatternError(`unexpected ':' in the static segment "${seg}"`, raw);
    }
    segments.push({ kind: "static", value: decoded });
  }

  return Object.freeze({
    raw,
    segments: Object.freeze(segments),
    paramNames: Object.freeze(paramNames),
  });
}

export type ValidateResult =
  | { readonly ok: true; readonly pattern: RoutePattern }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Non-throwing {@link parseRoutePattern}, for live validation in the CMS. */
export function validateRoutePattern(raw: string): ValidateResult {
  try {
    return { ok: true, pattern: parseRoutePattern(raw) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [message] };
  }
}

/**
 * The pattern with every `:name` rewritten to `:param` — the canonical form two
 * patterns share iff they match the same URLs. Mirrors the SQL
 * `regexp_replace(path, ':[a-z][a-zA-Z0-9_]*', ':param', 'g')` that backs
 * `route_bundles.normalized_path`, so TypeScript and Postgres agree by
 * construction. Throws {@link RoutePatternError} for a malformed pattern.
 */
export function normalizePattern(raw: string): string {
  parseRoutePattern(raw);
  return raw.replace(/:[a-z][a-zA-Z0-9_]*/g, ":param");
}

// --- Relative <-> absolute -------------------------------------------------

/**
 * Joins a parent's absolute pattern and this route's own contribution into the
 * child's absolute pattern.
 *
 * `parentPath === null` means a root route: `segment` is itself the absolute
 * path (`/blog`). Otherwise `segment` is exactly one path segment (`":slug"` or
 * `"reviews"`, no `/`). Throws {@link RoutePatternError} if the result is
 * malformed — including a child param whose name repeats one from the parent.
 */
export function composeAbsolutePattern(parentPath: string | null, segment: string): string {
  if (typeof segment !== "string" || segment === "") {
    throw new RoutePatternError("a path segment is required", String(segment));
  }

  if (parentPath === null) {
    return parseRoutePattern(segment).raw;
  }

  if (segment.startsWith("/")) {
    throw new RoutePatternError("a child route's segment must not start with '/'", segment);
  }
  if (segment.includes("/")) {
    throw new RoutePatternError("a child route contributes exactly one path segment", segment);
  }

  const parent = parseRoutePattern(parentPath);
  const absolute = `${parent.raw === "/" ? "" : parent.raw}/${segment}`;
  parseRoutePattern(absolute);
  return absolute;
}

/**
 * The inverse of {@link composeAbsolutePattern}: given a route's absolute
 * pattern and its parent's, returns the route's own segment. `parentPath ===
 * null` returns the whole path. Throws if `absolutePath` is not one segment
 * below `parentPath`.
 */
export function splitSegment(absolutePath: string, parentPath: string | null): string {
  const absolute = parseRoutePattern(absolutePath).raw;
  if (parentPath === null) return absolute;

  const parent = parseRoutePattern(parentPath).raw;
  const prefix = parent === "/" ? "/" : `${parent}/`;
  if (!absolute.startsWith(prefix)) {
    throw new RoutePatternError(`"${absolute}" is not directly under "${parent}"`, absolutePath);
  }
  const tail = absolute.slice(prefix.length);
  if (tail === "" || tail.includes("/")) {
    throw new RoutePatternError("a child route must add exactly one segment", absolutePath);
  }
  return tail;
}

// --- Matching -------------------------------------------------------------

export interface MatchCandidate<T> {
  /** An absolute pattern — see {@link parseRoutePattern}. */
  readonly pattern: string;
  readonly value: T;
}

export interface RouteMatch<T> {
  readonly value: T;
  readonly params: Readonly<Record<string, string>>;
  /** The winning candidate's pattern. */
  readonly pattern: string;
}

interface TrieNode<T> {
  /** Concrete next segment -> child. */
  readonly staticChildren: Map<string, TrieNode<T>>;
  /** The single `:param` branch, if any pattern has one here. */
  paramChild: TrieNode<T> | null;
  /** Set when a pattern ends here. */
  terminal: { value: T; pattern: string; paramNames: readonly string[] } | null;
}

/**
 * A compiled set of candidates. Param *names* live on the terminal, not on the
 * nodes, so two patterns that share a structural prefix but name a segment
 * differently (`/a/:x/b` and `/a/:y/c`) can share trie nodes without conflict.
 */
export interface RouteTrie<T> {
  readonly root: TrieNode<T>;
}

function newNode<T>(): TrieNode<T> {
  return { staticChildren: new Map(), paramChild: null, terminal: null };
}

/**
 * Compiles candidates into a {@link RouteTrie}. Throws
 * {@link RoutePatternCollisionError} if two candidates reach the same terminal —
 * i.e. are identical once param names are ignored.
 */
export function buildRouteTrie<T>(candidates: readonly MatchCandidate<T>[]): RouteTrie<T> {
  const root = newNode<T>();

  for (const candidate of candidates) {
    const parsed = parseRoutePattern(candidate.pattern);
    let node = root;

    for (const segment of parsed.segments) {
      if (segment.kind === "static") {
        let next = node.staticChildren.get(segment.value);
        if (!next) {
          next = newNode<T>();
          node.staticChildren.set(segment.value, next);
        }
        node = next;
      } else {
        node.paramChild ??= newNode<T>();
        node = node.paramChild;
      }
    }

    if (node.terminal) {
      throw new RoutePatternCollisionError(node.terminal.pattern, candidate.pattern);
    }
    node.terminal = {
      value: candidate.value,
      pattern: parsed.raw,
      paramNames: parsed.paramNames,
    };
  }

  return { root };
}

/**
 * Resolves a pathname against a compiled trie. Depth-first, **static child
 * before param child** at every step, backtracking on a dead end; the first
 * full-length match wins. Returns `null` when nothing matches.
 *
 * The pathname is normalised first (collapsed `//`, trailing `/` dropped except
 * for root, each segment percent-decoded once).
 */
export function matchRouteInTrie<T>(trie: RouteTrie<T>, pathname: string): RouteMatch<T> | null {
  const segments = toSegments(normalizeRequestPath(pathname).pathname);

  const walk = (node: TrieNode<T>, index: number, paramValues: string[]): RouteMatch<T> | null => {
    if (index === segments.length) {
      if (!node.terminal) return null;
      const params: Record<string, string> = {};
      node.terminal.paramNames.forEach((name, i) => {
        params[name] = paramValues[i] ?? "";
      });
      return { value: node.terminal.value, params, pattern: node.terminal.pattern };
    }

    const segment = segments[index]!;

    const staticChild = node.staticChildren.get(segment);
    if (staticChild) {
      const hit = walk(staticChild, index + 1, paramValues);
      if (hit) return hit;
    }

    if (node.paramChild) {
      const hit = walk(node.paramChild, index + 1, [...paramValues, segment]);
      if (hit) return hit;
    }

    return null;
  };

  return walk(trie.root, 0, []);
}

/**
 * Convenience: {@link buildRouteTrie} then {@link matchRouteInTrie}. Callers that
 * match many pathnames against one candidate set should build the trie once
 * instead. Propagates {@link RoutePatternCollisionError}.
 */
export function matchRoute<T>(
  pathname: string,
  candidates: readonly MatchCandidate<T>[],
): RouteMatch<T> | null {
  return matchRouteInTrie(buildRouteTrie(candidates), pathname);
}

// --- Request-path normalisation ----------------------------------------------

export interface NormalizeOptions {
  /**
   * Injected locale-prefix splitter, e.g. `i18n-core`'s `extractLocaleFromPath`
   * bound to the app's `LocaleConfig`. Left unset today (locale rides on a
   * cookie, not the URL); wired in here so activating URL-locale is a one-line
   * change at this seam rather than across every matcher call site.
   */
  readonly stripLocaleSegment?: (pathname: string) => { locale: string | null; pathname: string };
}

export interface NormalizedPath {
  /** Always starts with `/`; no trailing `/` except root; segments decoded. */
  readonly pathname: string;
  /** The locale a `stripLocaleSegment` hook peeled off, else `null`. */
  readonly locale: string | null;
}

/** Splits `"/a/b"` into `["a", "b"]`; `"/"` into `[]`. */
function toSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment !== "");
}

/**
 * Canonicalises an incoming request pathname so `/docs`, `/docs/` and `//docs`
 * all resolve identically. Lenient by design — this is untrusted input, unlike
 * {@link parseRoutePattern} which validates authored patterns.
 */
export function normalizeRequestPath(
  rawPathname: string,
  options: NormalizeOptions = {},
): NormalizedPath {
  const withSlash =
    typeof rawPathname === "string" && rawPathname.startsWith("/")
      ? rawPathname
      : `/${rawPathname ?? ""}`;

  const segments = toSegments(withSlash).map((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded.includes("/") ? segment : decoded;
    } catch {
      return segment;
    }
  });

  let pathname = segments.length > 0 ? `/${segments.join("/")}` : "/";
  let locale: string | null = null;

  if (options.stripLocaleSegment) {
    const stripped = options.stripLocaleSegment(pathname);
    locale = stripped.locale;
    pathname = stripped.pathname.startsWith("/") ? stripped.pathname : `/${stripped.pathname}`;
  }

  return { pathname, locale };
}

export interface BuildHrefOptions {
  /** Injected locale-prefixer, mirroring {@link NormalizeOptions.stripLocaleSegment}. */
  readonly localizePath?: (pathname: string) => string;
}

/**
 * Fills a pattern's `:name` segments from `params` to produce a concrete URL.
 * Throws {@link RoutePatternError} if a parameter is missing or empty. Each
 * value is percent-encoded.
 */
export function buildHref(
  pattern: string,
  params: Readonly<Record<string, string>>,
  options: BuildHrefOptions = {},
): string {
  const parsed = parseRoutePattern(pattern);

  const parts = parsed.segments.map((segment) => {
    if (segment.kind === "static") return encodeURIComponent(segment.value);
    const value = params[segment.value];
    if (typeof value !== "string" || value === "") {
      throw new RoutePatternError(`missing value for parameter ":${segment.value}"`, pattern);
    }
    return encodeURIComponent(value);
  });

  const href = parts.length > 0 ? `/${parts.join("/")}` : "/";
  return options.localizePath ? options.localizePath(href) : href;
}

// --- Hierarchy -----------------------------------------------------------

interface HasParent {
  readonly id: string;
  readonly parentId: string | null;
}

/**
 * The chain from the root of `leaf`'s tree down to `leaf` itself, root-first and
 * inclusive. Cycle-safe (stops if an id repeats); if a `parentId` is not in
 * `byId` the chain is simply truncated at that point — the caller decides what a
 * missing ancestor means.
 */
export function resolveParentChain<T extends HasParent>(
  leaf: T,
  byId: ReadonlyMap<string, T>,
): readonly T[] {
  const chain: T[] = [];
  const seen = new Set<string>();

  let current: T | undefined = leaf;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return chain.reverse();
}

/**
 * Whether pointing `startId` at `proposedParentId` would create a cycle —
 * because `startId` is `proposedParentId` itself, or appears among its
 * ancestors. Also returns `true` if the existing chain above `proposedParentId`
 * is already cyclic.
 */
export function findParentCycle<T extends HasParent>(
  startId: string,
  proposedParentId: string | null,
  byId: ReadonlyMap<string, T>,
): boolean {
  if (!proposedParentId) return false;
  if (proposedParentId === startId) return true;

  const seen = new Set<string>([startId]);
  let current = byId.get(proposedParentId);
  while (current) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

// --- SEO templating -----------------------------------------------------

/** The `{{name}}` placeholders in a string, deduped, in first-seen order. */
export function templatePlaceholders(template: string): readonly string[] {
  const names: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const name = match[1]!;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * Replaces every `{{name}}` with `params[name]`. An unknown placeholder becomes
 * `""` and is reported in `unknown` — a last-ditch guard; the CMS rejects
 * unknown placeholders before a route is ever saved.
 */
export function interpolateTemplate(
  template: string,
  params: Readonly<Record<string, string>>,
): { value: string; unknown: readonly string[] } {
  const unknown = new Set<string>();
  const value = template.replace(PLACEHOLDER_RE, (_, name: string) => {
    const replacement = params[name];
    if (typeof replacement === "string") return replacement;
    unknown.add(name);
    return "";
  });
  return { value, unknown: [...unknown] };
}

/** {@link interpolateTemplate} applied to every templatable field of a `RouteSeo`. */
export function interpolateSeo(
  seo: RouteSeo,
  params: Readonly<Record<string, string>>,
): RouteSeo {
  const fill = (value: string | undefined): string | undefined =>
    value === undefined ? undefined : interpolateTemplate(value, params).value;

  const next: {
    -readonly [K in keyof RouteSeo]: RouteSeo[K];
  } = {};

  if (seo.title !== undefined) next.title = fill(seo.title);
  if (seo.description !== undefined) next.description = fill(seo.description);
  if (seo.canonical !== undefined) next.canonical = fill(seo.canonical);
  if (seo.ogImage !== undefined) next.ogImage = fill(seo.ogImage);
  if (seo.robots !== undefined) next.robots = seo.robots;
  if (seo.keywords !== undefined) {
    next.keywords = seo.keywords.map((keyword) => interpolateTemplate(keyword, params).value);
  }

  return next;
}

// --- Param metadata ----------------------------------------------------

/**
 * Folds the `route_bundles.param_meta` JSON (`[{ name, label }, ...]`) into a
 * `name -> { label }` record. Tolerant of junk entries — a row with no usable
 * `name` is dropped, a missing `label` falls back to the name.
 */
export function paramMetaToRecord(raw: unknown): Readonly<Record<string, RouteParamMeta>> {
  if (!Array.isArray(raw)) return {};

  const out: Record<string, RouteParamMeta> = {};
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = record.name;
    if (typeof name !== "string" || !PARAM_NAME_RE.test(name)) continue;
    out[name] = { label: typeof record.label === "string" ? record.label : name };
  }
  return out;
}

// --- Collision helper for the CMS -------------------------------------------

/**
 * Members of `existing` whose canonical form (see {@link normalizePattern})
 * equals `candidate`'s — i.e. would collide with it. A malformed member is
 * skipped rather than throwing, so this stays usable for live CMS feedback.
 */
export function findPatternCollisions(
  existing: readonly string[],
  candidate: string,
): readonly string[] {
  const target = normalizePattern(candidate);
  return existing.filter((pattern) => {
    try {
      return normalizePattern(pattern) === target;
    } catch {
      return false;
    }
  });
}
