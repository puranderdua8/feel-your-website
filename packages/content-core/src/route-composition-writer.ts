import type { Locale, RouteBundle, RouteSectionNode, RouteSeo } from "./types.js";

/** One `:name` path parameter as the CMS authors it: the name plus a label. */
export interface RouteParamSpec {
  /** Matches a `:name` segment in the route's path pattern. */
  readonly name: string;
  /** Human label shown beside the parameter in the CMS. */
  readonly label: string;
}

/**
 * The write half of route composition, deliberately kept out of both
 * `ContentAdapter` (read-only) and `ConfigBundleStore` (whose fixed-vocabulary
 * contract suite must not have to grow a tree method).
 *
 * A route bundle *is* a config bundle — same header, same version, same audit
 * row — so a Supabase implementation of this seam calls the same
 * `write_bundle_header` / `raise_bundle_conflict` machinery as
 * `save_route_bundle`. But the shape it writes is a recursive section tree,
 * not a flat item list, so it earns its own narrow interface rather than
 * widening `ConfigBundleStore`.
 */

export interface RouteCompositionInput {
  /** The bundle's name (`config_bundles.name`), unique within the route vocabulary. */
  readonly name: string;
  /**
   * The absolute path it renders at, e.g. `/pricing`. Must start with `/`.
   *
   * Retained for callers that still author a flat absolute path. When
   * {@link pathSegment} is given it is authoritative and this is ignored; the
   * CMS route editor moves to `pathSegment` + {@link parentId} in a later
   * phase, at which point this field is dropped.
   */
  readonly path: string;
  /**
   * This route's own path contribution — the full path for a top-level route,
   * a single segment (`":slug"`, `"reviews"`) for a nested one. When set,
   * overrides {@link path}; the absolute pattern is composed from this and the
   * parent chain.
   */
  readonly pathSegment?: string;
  /** Parent route bundle id for layout nesting, or `null`/omitted for top-level. */
  readonly parentId?: string | null;
  /** Author metadata for the path's `:name` parameters, in order. */
  readonly params?: readonly RouteParamSpec[];
  readonly published: boolean;
  /** Root section instances in render order — the whole tree, replaced wholesale. */
  readonly tree: readonly RouteSectionNode[];
  /** SEO metadata per locale, replaced wholesale with the tree. `{}` for none. */
  readonly seo: Readonly<Record<Locale, RouteSeo>>;
}

export interface RouteCompositionWriter {
  /**
   * Creates (`bundleId: null`) or replaces (`bundleId` set) a route bundle's
   * entire section tree in one call.
   *
   * `expectedVersion` is the optimistic-concurrency token on an update — the
   * version the caller last read; `null` on a create. A mismatch throws
   * {@link RouteCompositionConflictError}; an unknown `bundleId` throws
   * {@link RouteCompositionError} with code `not_found`; missing `manage:routes`
   * throws code `forbidden`.
   *
   * `actor` is part of the signature for parity with `ConfigBundleStore`, but
   * a session-authenticated backend derives the real writer from the session,
   * never from this string.
   *
   * Returns the saved bundle, its `tree` echoed back and `items` set to the
   * pre-order flatten of it.
   */
  saveComposition(
    bundleId: string | null,
    input: RouteCompositionInput,
    expectedVersion: number | null,
    actor: string,
  ): Promise<RouteBundle>;

  /**
   * Deletes a route bundle and its whole section tree. `expectedVersion` is
   * the optimistic-concurrency token, same as `saveComposition`; a mismatch
   * throws {@link RouteCompositionConflictError}, an unknown `bundleId` throws
   * {@link RouteCompositionError} with code `not_found`.
   */
  deleteComposition(bundleId: string, expectedVersion: number, actor: string): Promise<void>;

  /**
   * Deletes a route bundle **and every descendant route** in one call — the
   * explicit, confirmed counterpart to {@link deleteComposition}, which refuses
   * when children exist. Only the root's `expectedVersion` is checked. A
   * mismatch throws {@link RouteCompositionConflictError}; an unknown `bundleId`
   * throws {@link RouteCompositionError} with code `not_found`.
   */
  deleteSubtree(bundleId: string, expectedVersion: number, actor: string): Promise<void>;
}

/** A route bundle's header — enough for the editor's route list. */
export interface RouteCompositionSummary {
  readonly id: string;
  readonly name: string;
  /** The absolute path pattern — see {@link RouteBundle.path}. */
  readonly path: string;
  /** This route's own path contribution — see {@link RouteBundle.pathSegment}. */
  readonly pathSegment: string;
  /** Parent route bundle id, or `null` for a top-level route. */
  readonly parentId: string | null;
  readonly published: boolean;
  readonly version: number;
  readonly updatedAt: string;
}

/**
 * One route's full composition, drafts included — what the CMS route editor
 * loads to edit. Richer than {@link RouteBundle}: it carries the bundle
 * `name` and `published` flag (which live on the config-bundle header, not on
 * the shell-facing `RouteBundle`), and no derived `items`.
 */
export interface RouteComposition extends RouteCompositionSummary {
  readonly tree: readonly RouteSectionNode[];
  /** SEO metadata per locale, drafts included — what the editor's SEO panel edits. */
  readonly seo: Readonly<Record<Locale, RouteSeo>>;
  /** Author metadata for the path's `:name` parameters, in order. */
  readonly params: readonly RouteParamSpec[];
}

/**
 * The read counterpart to {@link RouteCompositionWriter}, for the one caller
 * that needs a route's tree *before* it is published: the CMS editor.
 * `ContentAdapter.getRouteManifest` deliberately only ever returns published
 * bundles, so it cannot serve this.
 */
export interface RouteCompositionReader {
  /** Every route bundle's header, drafts included — the editor's route list. */
  listCompositions(): Promise<readonly RouteCompositionSummary[]>;

  /** One route's composition by bundle id, or `null` if there is no such route bundle. */
  getComposition(bundleId: string): Promise<RouteComposition | null>;
}
