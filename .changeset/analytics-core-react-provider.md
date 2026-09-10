---
"@feel-your-website/analytics-core": minor
---

Add the `./react` entry (`"use client"`): `<AnalyticsProvider>` + `useAnalytics()`.
Not mounted anywhere.

- Derives the browsing session on mount (`deriveSession` over `sessionStorage`,
  30-min sliding), decides sampling once per session id, and `init`s the adapter
  — re-`init`ing whenever `consentGranted` changes.
- `useAnalytics().emit(body)` stamps the envelope (session id, monotonic `seq`,
  `ts`, redacted `path`) and delivers to the adapter — **only** when consent is
  granted and the session is in the sample. That is the single gate.
- With a `collectorUrl`, `emit` also queues the event (capped at 200); the queue
  flushes on a timer (`flushIntervalMs`, default 15s), on `visibilitychange`
  → hidden, and on `pagehide` — `navigator.sendBeacon` under ~60 KB, else
  `fetch(keepalive)`.
- `useAnalytics` / the adapter path never throw out to the page.

No trackers yet — nothing calls `emit`.
