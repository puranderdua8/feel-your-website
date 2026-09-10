import type {
  ActionCacheStore,
  ActionCatalog,
  ActionContext,
  ActionInvoker,
  ActionResult,
  CacheEntry,
} from "@feel-your-website/action-core";
import type { JsonValue } from "@feel-your-website/content-core";

type JsonBody = Readonly<Record<string, JsonValue>>;

interface CacheConfig {
  readonly ttlMs: number;
  readonly swr?: boolean;
  readonly negativeTtlMs?: number;
}

/** Deterministic key: sorts object keys so `{a,b}` and `{b,a}` hash the same. */
export function cacheKey(actionId: string, body: JsonBody): string {
  return `${actionId}\0${stableStringify(body)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

export interface CachingActionInvokerOptions {
  readonly inner: ActionInvoker;
  readonly catalog: ActionCatalog;
  readonly store: ActionCacheStore;
  /** Injectable clock for tests. */
  readonly now?: () => number;
}

/**
 * Wraps an {@link ActionInvoker} with a read-through cache for `query` actions
 * that declare a `cache` config. A `mutation`, and any query without a cache
 * config, passes straight through.
 *
 * - **Fresh** (`now < expiresAt`): the stored result is returned as-is.
 * - **Stale but within grace** (`swr`, `now < staleUntil`): the stored result
 *   is returned immediately with `stale: true`, and a single background
 *   refresh is kicked off (guarded so concurrent stale hits don't each spawn
 *   one).
 * - **Expired / miss**: one fetch, with an in-flight guard so a burst of
 *   identical requests collapses to a single upstream call (dogpile guard).
 * - **Failure**: cached only if the action sets `cache.negativeTtlMs`, and
 *   only for that long — so a broken upstream is not retried on every render,
 *   but a transient error clears quickly. Failures are never served stale.
 */
export class CachingActionInvoker implements ActionInvoker {
  readonly #inner: ActionInvoker;
  readonly #catalog: ActionCatalog;
  readonly #store: ActionCacheStore;
  readonly #now: () => number;
  readonly #inflight = new Map<string, Promise<ActionResult>>();

  constructor(options: CachingActionInvokerOptions) {
    this.#inner = options.inner;
    this.#catalog = options.catalog;
    this.#store = options.store;
    this.#now = options.now ?? Date.now;
  }

  async invoke(actionId: string, body: JsonBody, context: ActionContext): Promise<ActionResult> {
    const def = this.#catalog.byId.get(actionId);
    if (!def || def.kind !== "query" || !def.cache) {
      return this.#inner.invoke(actionId, body, context);
    }

    const cache: CacheConfig = def.cache;
    const key = cacheKey(actionId, body);
    const now = this.#now();
    // A shared store may be briefly unavailable — treat that exactly like a miss.
    const hit = await this.#store.get(key).catch(() => undefined);

    if (hit) {
      const cached = hit.value as ActionResult;
      if (now < hit.expiresAt) return cached;
      if (cache.swr && now < hit.staleUntil) {
        void this.#load(key, actionId, body, context, cache).catch(() => undefined);
        // Only an `ok` result is ever kept past its ttl (failures are not
        // served stale), so the `stale` marker only lands on a success.
        return cached.ok ? { ...cached, stale: true } : cached;
      }
      void this.#store.delete(key).catch(() => undefined);
    }

    return this.#load(key, actionId, body, context, cache);
  }

  #load(
    key: string,
    actionId: string,
    body: JsonBody,
    context: ActionContext,
    cache: CacheConfig,
  ): Promise<ActionResult> {
    const existing = this.#inflight.get(key);
    if (existing) return existing;

    const pending = this.#inner
      .invoke(actionId, body, context)
      .then((result) => {
        this.#persist(key, result, cache);
        return result;
      })
      .finally(() => {
        this.#inflight.delete(key);
      });

    this.#inflight.set(key, pending);
    return pending;
  }

  #persist(key: string, result: ActionResult, cache: CacheConfig): void {
    const now = this.#now();

    // Fire-and-forget: the caller must not wait on a cache write, and a lost
    // write is just a miss next time (the store's contract).
    const write = (entry: CacheEntry): void => {
      void this.#store.set(key, entry).catch(() => undefined);
    };

    if (result.ok) {
      // Store the result without any `stale` marker; the read path adds one.
      write({
        value: { ok: true, data: result.data },
        expiresAt: now + cache.ttlMs,
        staleUntil: now + cache.ttlMs + (cache.swr ? cache.ttlMs : 0),
      });
      return;
    }

    if (cache.negativeTtlMs && cache.negativeTtlMs > 0) {
      write({
        value: result,
        expiresAt: now + cache.negativeTtlMs,
        staleUntil: now + cache.negativeTtlMs,
      });
    }
  }
}
