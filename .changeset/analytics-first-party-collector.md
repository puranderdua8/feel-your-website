---
"@feel-your-website/analytics-core": minor
"@feel-your-website/shell": patch
---

Add the first-party analytics collector.

- `analytics-core/react`: `<AnalyticsProvider>`'s `collectorUrl` (URL +
  `sendBeacon`/`fetch`) is replaced by `sendBatch?: (events) => void` — a
  host-supplied transport called with the queued batch on the flush timer, on
  `visibilitychange` → hidden, and on `pagehide`. The provider no longer knows
  about URLs or beacons; a throwing `sendBatch` is swallowed.
- `shell`: `ingestAnalytics` — a `createServerFn({ method: "POST" })` that
  `assertSameOrigin()`s, structurally validates the batch (`parseAnalyticsBatch`
  — closed `type`, well-formed envelope, type-specific fields, per-event 4 KB
  cap, 50-event batch cap; malformed events dropped, never a 4xx), and hands
  the survivors to `getAnalyticsSink()`.
- `shell`: `getAnalyticsSink()` DI — `ANALYTICS_SINK=console` (default) →
  `ConsoleAnalyticsSink`; an unknown value throws (the Measurement Protocol
  sink is a follow-up). `AppAnalyticsProvider` wires `sendBatch` to
  `ingestAnalytics` when `ANALYTICS_COLLECTOR_PATH` is set (any non-empty value
  turns the collector on).
- env: `ANALYTICS_SINK` added to the manifest, `turbo.json` and `.env.example`.
