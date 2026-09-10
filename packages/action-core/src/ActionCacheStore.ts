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
 * Deliberately dumb: an async key/value map with no policy of its own —
 * freshness, SWR and eviction all live in the caller. The methods are
 * `Promise`-returning so a shared backend (Netlify Blobs, Redis) is a drop-in
 * swap for the process-local default. Best-effort by contract: an
 * implementation may lose entries at any time (a cold serverless instance, an
 * eviction, a network blip), so a miss — or a rejected `get` — is always
 * normal and the caller treats it as one.
 */
export interface ActionCacheStore {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Process-local {@link ActionCacheStore}. Lives for one warm runtime instance. */
export class InMemoryActionCacheStore implements ActionCacheStore {
  readonly #entries = new Map<string, CacheEntry>();

  get(key: string): Promise<CacheEntry | undefined> {
    return Promise.resolve(this.#entries.get(key));
  }

  set(key: string, entry: CacheEntry): Promise<void> {
    this.#entries.set(key, entry);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#entries.delete(key);
    return Promise.resolve();
  }
}
