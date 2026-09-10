---
"@feel-your-website/analytics-core": minor
---

Add the adapter contract suite and the memory fake. Still inert.

- `MemoryAnalyticsAdapter` — records every delivered event in order, exposes
  the last `init` config / `identify` id, buffers events tracked before `init`
  and flushes them after. `throwOnTrack` is a fault injector (for testing that
  a _consumer_ swallows a broken vendor) — a real adapter never throws, so the
  contract never sets it.
- `./contract-tests` entry — `runAnalyticsAdapterContract`. Every adapter: no
  method throws (before or after `init`; `init` twice is safe). Given an
  observable surface: an event tracked before `init` is delivered after, in
  order; events after `init` deliver immediately.
- `contract.test.ts` runs it for `NoopAnalyticsAdapter` (throws-only checks) and
  `MemoryAnalyticsAdapter` (full).
