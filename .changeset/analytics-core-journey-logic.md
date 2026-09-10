---
"@feel-your-website/analytics-core": minor
---

Add the pure session / journey / redaction logic. Still nothing consumes it.

- `session.ts` — `deriveSession({ previous, now, freshId })`: a 30-minute
  sliding window (`SESSION_IDLE_MS`), keeping `id` / `startedAt` while it slides.
  `hashString` (FNV-1a) + `isSampled(sessionId, rate)` — deterministic per
  session, so a journey is never half-sampled.
- `journey.ts` — `createJourneyCounter()`: a monotonic `seq` per session, from
  1, that restarts when the session id changes.
- `redact.ts` — `redactText` (mask emails / long digit runs, collapse
  whitespace, cap at `MAX_TEXT_LEN`) and `redactPath` (drop query + fragment,
  collapse id-shaped segments to `:id`).
- `resolve-click-target.ts` — `resolveClickTarget(eventTarget, { classifyHref? })`:
  walks to the nearest `Element`, then the nearest actionable ancestor, and
  returns a privacy-safe `ClickEvent` body (redacted label, `href`, injected
  `linkKind`, `newTab`) or `null` for a non-Element target.
