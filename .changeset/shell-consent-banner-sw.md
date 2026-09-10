---
"@feel-your-website/shell": patch
---

Consent UX + service-worker analytics exclusions — the last of the analytics
workstream.

- `consent-banner.tsx` — an accessible prompt (`role="dialog"`, Accept /
  Decline) shown only while consent is `unknown` and the client has read its
  stored value, so a returning visitor or a DNT/GPC browser never sees it. A
  choice persists via `consent-core` (cookie + storage), so the next SSR render
  already knows. Mounted in `__root.tsx` inside `<ConsentProvider>`.
- `generate-sw.mjs` — two `NetworkOnly` runtime rules ahead of the caching
  ones: the Google Analytics / Tag Manager origins, and every `POST /_serverFn/`
  (so `invokeAction` / `setLocale` / `ingestAnalytics` are never cached and a
  failed POST never gets a cached fallback).

Consent Mode is already correct on the first `GaAnalyticsAdapter.init` — the
provider seeds from `bootstrap.consent` — and `gtag.js` only loads inside that
client-side `init`, so there is no pre-hydration analytics to gate.
