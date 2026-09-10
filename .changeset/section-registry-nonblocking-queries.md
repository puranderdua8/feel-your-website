---
"@feel-your-website/section-registry": minor
---

Groundwork for non-blocking section queries (A23). Inert — no host defers a
section yet.

- `SectionDataEntry` gains a `{ pending: true }` variant — a non-blocking
  section whose data is still being fetched client-side.
- `partitionInvocations(collected)` splits `collectInvocations` output into
  `blocking` (run during SSR — the page waits) and `deferred` (handed to the
  client to fetch after paint).
- `RenderCompositionOptions.pendingSections?: ReadonlySet<string>` — an
  instance id in the set with no real `sectionData` entry gets
  `{ pending: true }` as its `data` prop.
- `ReleaseFeedSection` renders a fixed-height skeleton for `{ pending: true }`
  so a deferred fetch resolving does not shift layout.
