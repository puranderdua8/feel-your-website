---
"@feel-your-website/action-core": minor
"@feel-your-website/cms": minor
"@feel-your-website/shell": patch
---

Publish-gate a `mode: "action"` CTA against the action catalog.

- `action-core`: `parseActionInputMapping(raw)` — an authored `actionBody` value
  (a JSON string, or an already-parsed object) → a typed `ActionInputMapping`,
  or `null`. Moved here from `apps/shell` so both apps share one parser.
- `cms`: `collectRouteButtonIssues` now runs catalog-aware checks on every
  `mode: "action"` button — the id must name a **registered mutation**, and the
  body mapping must parse and bind cleanly to that action's inputs
  (`validateActionBinding`, with the route's own param names). All blocking, so
  Publish is disabled until they are resolved; a draft still saves. `PublishBar`
  passes the route's `paramNames` through `checkRoutePublishReadiness`.
- `shell`: `build-action-body.ts` / `invoke-action.ts` import
  `parseActionInputMapping` from `action-core` instead of defining it.
