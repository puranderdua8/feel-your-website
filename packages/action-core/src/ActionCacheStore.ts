/**
 * One cached entry: the value plus the two clocks the stale-while-revalidate
 * policy needs.
 */
export interface CacheEntry<T = unknown> {
  readonly value: T;
  /** Epoch ms after which the entry is stale (a background refresh is due). */
  readonly expiresAt: number;
  /** Epoch ms after which even a stale entry must not be served. */
  readonly staleUntil: number;
}

/**
 * Where an {@link import("./ActionInvoker.js").ActionInvoker} keeps `query`
 * responses between calls.
 *
 * Deliberately dumb: a synchronous key/value map with no policy of its own —
 * freshness, SWR and eviction all live in the caller. Best-effort by
 * contract: an implementation may lose entries at any time (a cold serverless
 * instance, an eviction), so a miss is always normal. The default is
 * process-local; a shared store (e.g. Netlify Blobs) is an opt-in swap.
 */
export interface ActionCacheStore {
  get(key: string): CacheEntry | undefined;
  set(key: string, entry: CacheEntry): void;
  delete(key: string): void;
}

/** Process-local {@link ActionCacheStore}. Lives for one warm runtime instance. */
export class InMemoryActionCacheStore implements ActionCacheStore {
  readonly #entries = new Map<string, CacheEntry>();

  get(key: string): CacheEntry | undefined {
    return this.#entries.get(key);
  }

  set(key: string, entry: CacheEntry): void {
    this.#entries.set(key, entry);
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }
}
