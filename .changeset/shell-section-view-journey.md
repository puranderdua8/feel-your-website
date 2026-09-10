---
"@feel-your-website/shell": patch
---

Wire section-view tracking — the journey is now complete end to end.

`RoutePageView` passes `onSectionInView` (a stable `useSectionView()` callback
that emits `{ type: "section_view", sectionKey, instanceId }`) into
`renderComposition`, so every top-level section reports the first time it
scrolls into view. Together with the pageview and click trackers a session's
events now form one ordered journey: a `page`, then `section_view`s in scroll
order, then `click`s — all under one `sessionId` with a monotonic `seq`.

Still Noop in production (no `ANALYTICS_PROVIDER`) and gated on granted consent.
