---
"@feel-your-website/action-core": minor
"@feel-your-website/action-invoker-http": patch
---

Make `ActionCacheStore` async so a shared backend can be dropped in.

- `ActionCacheStore.get` / `set` / `delete` now return a `Promise`.
  `InMemoryActionCacheStore` keeps its synchronous `Map` internally and just
  wraps the returns.
- `CachingActionInvoker.invoke` awaits the read (a rejected `get` is treated as
  a miss); cache writes and the expired-entry delete are fire-and-forget so the
  response never waits on the cache. Behaviour is unchanged with the in-memory
  store.

Groundwork for the Netlify Blobs store (`ACTION_CACHE=blobs`).
