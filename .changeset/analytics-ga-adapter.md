---
"@feel-your-website/analytics-ga": minor
"@feel-your-website/shell": patch
---

Add the GA4 adapter — the first analytics that can leave the browser.

- `packages/analytics-ga` (new): `GaAnalyticsAdapter` implements
  `AnalyticsAdapter`. On `init` it installs the `gtag` shim, sets **Consent
  Mode v2 to all-denied** before `gtag.js` loads (`wait_for_update: 500`),
  disables GA's own `page_view`, then loads the script once; it flips
  `analytics_storage` to `granted` only when consent is given, and on a later
  `init` with changed consent sends a `consent` `update` without re-bootstrapping.
  `track` maps the envelope: `page` → `page_view`, `section_view` →
  `section_view`, `click` → `click`, each carrying `fyw_session_id` / `fyw_seq`
  so our journey survives alongside GA's own session. No-op on the server;
  never throws. `loadScript` / `gtag` are injectable for tests.
- `shell`: `createAnalyticsAdapter` returns `GaAnalyticsAdapter` for
  `ANALYTICS_PROVIDER=ga` with a measurement id (Noop otherwise).
