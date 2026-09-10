---
"@feel-your-website/consent-core": minor
---

New package: analytics/marketing consent state. Nothing consumes it yet.

- `.` (SSR-safe core) — `ConsentStatus` (`unknown` / `granted` / `denied`),
  `readStoredConsent` / `writeStoredConsent` (localStorage + a `SameSite=Lax`
  cookie, defensive against a blocked store), `readConsentCookie` for a raw
  header, `isPrivacySignalSet` (DNT `"1"`/`"yes"`, GPC), and a pure
  `resolveConsent(stored, signal)` that forces `denied` whenever a signal is
  set.
- `./react` (`"use client"`) — `<ConsentProvider>` + `useConsent()`
  (`{ status, ready, setConsent }`). Seeds from an SSR `initial`, re-reads
  storage + signals on mount, and refuses a `granted` call while DNT/GPC is on.
  `useConsent` throws outside a provider so an un-gated consumer fails loudly.
