---
"@feel-your-website/analytics-core": minor
---

New package: the analytics vocabulary and seams. Nothing consumes it yet.

- `types.ts` — the **closed** event union (`page` / `section_view` / `click`,
  with `ClickEvent.linkKind?` / `newTab?` and a privacy-safe `ClickTarget`)
  over a shared `AnalyticsContext` envelope (`sessionId`, monotonic `seq`, `ts`,
  `path`); `ANALYTICS_EVENT_TYPES`; the `AnalyticsAdapter` (client → vendor) and
  `AnalyticsSink` (server batch → destination) interfaces, both required never
  to throw.
- `noop.ts` — `NoopAnalyticsAdapter` (accepts everything, sends nothing — the
  unset-provider default) and `ConsoleAnalyticsSink` (logs each batch).

The pure journey/session logic (B3), the adapter contract suite (B4) and the
React provider (B5) land as further modules.
