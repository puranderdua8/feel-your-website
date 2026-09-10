---
"@feel-your-website/action-invoker-http": minor
"@feel-your-website/shell": patch
---

Add `NetlifyBlobsActionCacheStore` and wire `ACTION_CACHE=blobs` (A24b).

- `NetlifyBlobsActionCacheStore` (`@netlify/blobs`) — a fleet-wide
  {@link ActionCacheStore}: a query response cached by one serverless instance
  is a hit on every other, and on a cold one. Keys are FNV-1a-hashed to 16 hex
  chars (bounds the blob key, strips the `\0` in `cacheKey`); a stored blob
  that isn't a well-formed `CacheEntry` reads as a miss. `getStore` is called
  lazily in the constructor; the store slice is injectable for tests.
- `apps/shell/src/server/adapters.ts` — `ACTION_CACHE=blobs` now builds this
  store instead of throwing "not implemented". `getStore()` still needs a
  Netlify runtime; the caching invoker degrades a store outage to the no-cache
  path (`get` rejection → miss, writes fire-and-forget), so a Blobs blip is
  never a page error.
