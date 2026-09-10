---
"@feel-your-website/analytics-core": minor
"@feel-your-website/shell": patch
---

Enable the pageview tracker — the first journey signal.

- `analytics-core/react`: `usePageview(path)` emits a `page` event whenever
  `path` changes (once on mount for a non-null path, then per distinct value;
  a re-render with the same path is deduped). `document.referrer` rides on the
  first page of the session only. Router-agnostic — the host passes the path.
- `analytics-core/react`: the provider's session bootstrap moved into an
  idempotent `ensureSession()` that `emit` also calls, so a child tracker whose
  mount effect runs before the provider's no longer drops its first event (it
  buffers on the adapter and flushes on `init`).
- `shell`: `PageviewTracker` feeds `useRouterState(s => s.location.pathname)`
  into `usePageview`, mounted inside `<AnalyticsProvider>` by `AppAnalyticsProvider`.

Still Noop in production (no `ANALYTICS_PROVIDER`), and every emit is gated on
granted consent.
