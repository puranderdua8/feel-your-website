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
}
