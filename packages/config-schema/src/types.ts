/**
 * The shared "assignable configuration" substrate.
 *
 * Role↔permission management and route↔template management are two instances
 * of one pattern: a named, versioned, audited bundle of items drawn from a
 * fixed, code-defined vocabulary. This implements that pattern once.
 *
 * What is deliberately *not* shared is the code that interprets a bundle. The
 * RBAC guard reads RoleBundles; the route renderer reads RouteBundles.
 * Enforcement and rendering stay separate, code-level consumers. Only the
 * data-management plumbing — CRUD, versioning, audit, validation — is common.
 * Sharing the interpretation instead would be the mistake this design exists
 * to avoid: access-control *logic* stays fixed code, only the *mapping* is
 * data.
 */
export interface ConfigBundle<TItem extends string = string> {
  id: string;
  name: string;
  /** Items, validated against the relevant fixed catalog before write. */
  items: readonly TItem[];
  /**
   * Monotonic, incremented on every write.
   *
   * Doubles as the optimistic-concurrency token: a writer states the version
   * it read, and a mismatch means someone else changed the bundle in between.
   */
  version: number;
  updatedAt: string;
  /** Subject id of the last writer. The audit trail's "who". */
  updatedBy: string;
}

/** A point-in-time copy of a bundle, written on every change. */
export interface ConfigBundleVersion<TItem extends string = string> {
  bundleId: string;
  version: number;
  name: string;
  items: readonly TItem[];
  updatedAt: string;
  updatedBy: string;
  /** What happened to produce this version. */
  action: "created" | "updated" | "deleted";
}

export interface CreateBundleInput<TItem extends string = string> {
  name: string;
  items: readonly TItem[];
}

export interface UpdateBundleInput<TItem extends string = string> {
  name?: string;
  items?: readonly TItem[];
}

/**
 * Storage for config bundles of one vocabulary.
 *
 * An interface rather than a concrete store so the substrate is as portable
 * as everything else here — the Supabase implementation and the in-memory one
 * are both just implementations.
 */
export interface ConfigBundleStore<TItem extends string = string> {
  list(): Promise<readonly ConfigBundle<TItem>[]>;
  get(id: string): Promise<ConfigBundle<TItem> | null>;

  create(input: CreateBundleInput<TItem>, actor: string): Promise<ConfigBundle<TItem>>;

  /**
   * Updates a bundle.
   *
   * `expectedVersion` is required, not optional: two editors in a CMS is the
   * normal case, not an edge case, and a last-write-wins update silently
   * discards the other person's change. A mismatch throws `ConfigConflictError`.
   */
  update(
    id: string,
    input: UpdateBundleInput<TItem>,
    expectedVersion: number,
    actor: string,
  ): Promise<ConfigBundle<TItem>>;

  delete(id: string, expectedVersion: number, actor: string): Promise<void>;

  /** Full version history, newest first. */
  history(id: string): Promise<readonly ConfigBundleVersion<TItem>[]>;
}
