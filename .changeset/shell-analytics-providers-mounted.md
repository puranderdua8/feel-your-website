---
"@feel-your-website/shell": patch
---

Mount the consent + analytics providers. Zero behaviour — the adapter is a
no-op and nothing is tracked yet.

- `server/config/analytics.ts` — `parseAnalyticsConfig` (`ANALYTICS_PROVIDER`
  `none` / `ga`, `ANALYTICS_GA_MEASUREMENT_ID`, `ANALYTICS_COLLECTOR_PATH`,
  `ANALYTICS_SAMPLE_RATE`) and `loadAnalyticsConfig`, which degrades a bad value
  to "off" with a warning rather than failing the page.
- `BootstrapPayload` gains `analytics` (all browser-safe) and `consent` (read
  from the cookie server-side so the first client render matches).
- `analytics/adapter.ts` — `createAnalyticsAdapter(config)`, the one place a
  concrete client adapter is named; `none`/`ga` both return `NoopAnalyticsAdapter`
  until the GA adapter lands.
- `analytics/provider.tsx` — `AppAnalyticsProvider`: reads `useConsent()` and
  feeds `consentGranted` / `collectorUrl` / `sampleRate` into `<AnalyticsProvider>`.
- `__root.tsx` wraps the tree in `<ConsentProvider initial={bootstrap.consent}>`
  → `<AppAnalyticsProvider>`.
- The four `ANALYTICS_*` vars added to `env-manifest.ts`, `turbo.json` and
  `.env.example`.
