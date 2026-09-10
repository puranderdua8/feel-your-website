import { getStore } from "@netlify/blobs";
import type { ActionCacheStore, CacheEntry } from "@feel-your-website/action-core";

/**
 * The slice of `@netlify/blobs`'s `Store` this cache uses — enough to fake in a
 * test. Write results are ignored, so the return types are deliberately loose.
 */
export interface BlobStoreLike {
  get(key: string, options: { type: "json" }): Promise<unknown>;
  setJSON(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export interface NetlifyBlobsActionCacheStoreOptions {
  /** Blob-store name. Default `"fyw-action-cache"`. */
  readonly name?: string;
  /** Inject a store for tests; otherwise `getStore(name)` (Netlify ambient context). */
  readonly store?: BlobStoreLike;
}

/** FNV-1a → 16 hex chars. Bounds the blob key and strips the `\0` our `cacheKey` uses. */
function hashKey(input: string): string {
  const fnv = (seed: number): number => {
    let hash = seed;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  };
  return (fnv(0x811c9dc5).toString(16).padStart(8, "0") +
    fnv(0x9e3779b1).toString(16).padStart(8, "0")) as string;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof (value as { expiresAt?: unknown }).expiresAt === "number" &&
    typeof (value as { staleUntil?: unknown }).staleUntil === "number"
  );
}

/**
 * A fleet-wide {@link ActionCacheStore} backed by Netlify Blobs, so a query
 * response cached by one serverless instance is a hit on every other — and on
 * a cold one. Selected by `ACTION_CACHE=blobs`.
 *
 * Still best-effort: the caller ({@link CachingActionInvoker}) treats a
 * rejected `get` as a miss and fires writes without awaiting, so a Blobs blip
 * degrades to the no-cache path, never an error.
 */
export class NetlifyBlobsActionCacheStore implements ActionCacheStore {
  readonly #store: BlobStoreLike;

  constructor(options: NetlifyBlobsActionCacheStoreOptions = {}) {
    this.#store =
      options.store ?? (getStore(options.name ?? "fyw-action-cache") as unknown as BlobStoreLike);
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    const raw = await this.#store.get(hashKey(key), { type: "json" });
    return isCacheEntry(raw) ? raw : undefined;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.#store.setJSON(hashKey(key), entry);
  }

  async delete(key: string): Promise<void> {
    await this.#store.delete(hashKey(key));
  }
}
