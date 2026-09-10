---
"@feel-your-website/analytics-sink-ga": minor
"@feel-your-website/shell": patch
---

Build the GA4 Measurement Protocol sink and wire `ANALYTICS_SINK=ga`.

- **`packages/analytics-sink-ga`** (new) — `MeasurementProtocolSink`
  implements `AnalyticsSink`: it maps each `AnalyticsEvent` to a GA4 event
  (`toMpEvent`, mirroring `GaAnalyticsAdapter`'s client-side mapping), groups a
  batch by session into one `POST /mp/collect` per `client_id` (max 25 events
  each, `toMpPayloads`), and sends with an `AbortController` timeout. It never
  throws and resolves `false` on any non-2xx, network error or timeout — a
  dropped batch, never a 500 on `ingestAnalytics`. The endpoint and `fetch` are
  injectable for tests / GA's debug endpoint.
- **`apps/shell/src/server/adapters.ts`** — `getAnalyticsSink()` now builds
  `MeasurementProtocolSink` for `ANALYTICS_SINK=ga`, from
  `ANALYTICS_GA_MEASUREMENT_ID` (reused) and the new secret
  `ANALYTICS_MP_API_SECRET`. `ga` without either credential, or any other
  value, is a startup error (a misconfigured sink is a deploy bug). `console`
  stays the default.
- `ANALYTICS_MP_API_SECRET` added to the env manifest, `turbo.json` globalEnv
  and `.env.example`; `analytics-sink-ga` added to `seam.test.ts`'s
  concrete-backend list so it can only be named at the DI seam.

This is the last item from the registered-actions + analytics plan.
