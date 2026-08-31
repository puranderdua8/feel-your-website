import { ConfigConflictError, ConfigStoreError, InvalidItemsError } from "./errors.js";
import type {
  ConfigBundle,
  ConfigBundleStore,
  ConfigBundleVersion,
  CreateBundleInput,
  UpdateBundleInput,
} from "./types.js";

/** Validates items against a fixed vocabulary. Returns the unknown ones. */
export type VocabularyCheck = (items: readonly string[]) => readonly string[];

export interface MemoryConfigBundleStoreOptions {
  /**
   * The fixed vocabulary items are validated against.
   *
   * Required: a bundle store with no vocabulary is just a list of strings,
   * and the whole point of the substrate is that items are drawn from a
   * closed, code-defined set.
   */
  findUnknownItems: VocabularyCheck;
  /**
   * Items that must never be assignable through this store, even though they
   * are valid vocabulary — `manage:roles` being the motivating case. Seeded
   * directly instead, which closes both privilege escalation and lockout.
   */
  forbiddenItems?: readonly string[];
  seed?: readonly ConfigBundle[];
  now?: () => Date;
  newId?: () => string;
}

export class MemoryConfigBundleStore<
  TItem extends string = string,
> implements ConfigBundleStore<TItem> {
  readonly #bundles = new Map<string, ConfigBundle<TItem>>();
  readonly #history = new Map<string, ConfigBundleVersion<TItem>[]>();
  readonly #findUnknownItems: VocabularyCheck;
  readonly #forbidden: ReadonlySet<string>;
  readonly #now: () => Date;
  readonly #newId: () => string;

  #counter = 0;

  constructor(options: MemoryConfigBundleStoreOptions) {
    this.#findUnknownItems = options.findUnknownItems;
    this.#forbidden = new Set(options.forbiddenItems ?? []);
    this.#now = options.now ?? (() => new Date());
    this.#newId = options.newId ?? (() => `bundle-${++this.#counter}`);

    for (const bundle of options.seed ?? []) {
      this.#bundles.set(bundle.id, bundle as ConfigBundle<TItem>);
    }
  }

  async list(): Promise<readonly ConfigBundle<TItem>[]> {
    // Sorted for deterministic output — callers render these in order.
    return [...this.#bundles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  async get(id: string): Promise<ConfigBundle<TItem> | null> {
    // Missing is an expected outcome, not a failure.
    return this.#bundles.get(id) ?? null;
  }

  async create(input: CreateBundleInput<TItem>, actor: string): Promise<ConfigBundle<TItem>> {
    this.#validate(input.items);

    const bundle: ConfigBundle<TItem> = {
      id: this.#newId(),
      name: input.name,
      items: [...input.items],
      version: 1,
      updatedAt: this.#now().toISOString(),
      updatedBy: actor,
    };

    this.#bundles.set(bundle.id, bundle);
    this.#record(bundle, "created");
    return bundle;
  }

  async update(
    id: string,
    input: UpdateBundleInput<TItem>,
    expectedVersion: number,
    actor: string,
  ): Promise<ConfigBundle<TItem>> {
    const existing = this.#require(id);

    // Checked before validation so a stale editor is told they are stale,
    // rather than being sent to fix items that may no longer be relevant.
    if (existing.version !== expectedVersion) {
      throw new ConfigConflictError(expectedVersion, existing.version);
    }

    if (input.items) this.#validate(input.items);

    const updated: ConfigBundle<TItem> = {
      ...existing,
      name: input.name ?? existing.name,
      items: input.items ? [...input.items] : existing.items,
      version: existing.version + 1,
      updatedAt: this.#now().toISOString(),
      updatedBy: actor,
    };

    this.#bundles.set(id, updated);
    this.#record(updated, "updated");
    return updated;
  }

  async delete(id: string, expectedVersion: number, actor: string): Promise<void> {
    const existing = this.#require(id);

    if (existing.version !== expectedVersion) {
      throw new ConfigConflictError(expectedVersion, existing.version);
    }

    this.#bundles.delete(id);
    // The tombstone stays in history: an audit trail that forgets deletions
    // cannot answer "who removed this permission from that role?".
    this.#record({ ...existing, version: existing.version + 1, updatedBy: actor }, "deleted");
  }

  async history(id: string): Promise<readonly ConfigBundleVersion<TItem>[]> {
    return [...(this.#history.get(id) ?? [])].sort((a, b) => b.version - a.version);
  }

  #require(id: string): ConfigBundle<TItem> {
    const existing = this.#bundles.get(id);
    if (!existing) {
      throw new ConfigStoreError("not_found", `No bundle with id ${id}.`);
    }
    return existing;
  }

  #validate(items: readonly string[]): void {
    const unknown = this.#findUnknownItems(items);
    const forbidden = items.filter((item) => this.#forbidden.has(item));

    // Reported together so an editor sees every problem at once rather than
    // discovering them one failed save at a time.
    const problems = [...new Set([...unknown, ...forbidden])].sort();
    if (problems.length > 0) throw new InvalidItemsError(problems);
  }

  #record(bundle: ConfigBundle<TItem>, action: ConfigBundleVersion["action"]): void {
    const entries = this.#history.get(bundle.id) ?? [];
    entries.push({
      bundleId: bundle.id,
      version: bundle.version,
      name: bundle.name,
      items: [...bundle.items],
      updatedAt: bundle.updatedAt,
      updatedBy: bundle.updatedBy,
      action,
    });
    this.#history.set(bundle.id, entries);
  }
}
