import type { RouteBundle, RouteSectionNode } from "./types.js";

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
  /** The path it renders at, e.g. `/pricing`. Must start with `/`. */
  readonly path: string;
  readonly published: boolean;
  /** Root section instances in render order — the whole tree, replaced wholesale. */
  readonly tree: readonly RouteSectionNode[];
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
}

/** A route bundle's header — enough for the editor's route list. */
export interface RouteCompositionSummary {
  readonly id: string;
  readonly name: string;
  readonly path: string;
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
