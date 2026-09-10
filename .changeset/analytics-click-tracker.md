---
"@feel-your-website/analytics-core": minor
"@feel-your-website/shell": patch
---

Enable the global click tracker.

- `analytics-core/react`: `useClickTracking({ classifyHref? })` installs **one**
  capture-phase `document` listener and emits a `click` event for every
  primary-button click that lands on something interactive — a link, a button,
  a `[role]`, a `[data-analytics-id]`, or a form control. Clicks on inert page
  chrome are dropped. `resolveClickTarget` supplies the privacy-safe descriptor;
  `classifyHref` (injected) fills `linkKind`. Listener removed on unmount.
- `shell`: `ClickTracker` passes `section-registry`'s `classifyHref` through so a
  click's `linkKind` matches how the link renders, mounted inside
  `<AnalyticsProvider>` next to `PageviewTracker`.

Still Noop in production and gated on granted consent.
