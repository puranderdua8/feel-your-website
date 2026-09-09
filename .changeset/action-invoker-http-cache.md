---
"@feel-your-website/action-invoker-http": minor
---

`@feel-your-website/action-invoker-http` gains `CachingActionInvoker` — a
read-through cache decorator for `query` actions that declare a `cache` config.
A `mutation`, and any query without a cache config, passes straight through.

- fresh (`now < expiresAt`) → the stored result as-is
- stale within the grace window (`swr`, `now < staleUntil`) → the stored result
  with `stale: true`, plus one guarded background refresh
- expired / miss → one fetch, with an in-flight guard collapsing a burst of
  identical requests into a single upstream call (dogpile guard)
- failure → cached only for `cache.negativeTtlMs`, never served stale

`cacheKey(actionId, body)` sorts object keys so payload key order does not
matter. Still inert — the shell's DI wraps `HttpActionInvoker` in this later.
