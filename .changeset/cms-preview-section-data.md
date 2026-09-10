---
"@feel-your-website/section-registry": minor
"@feel-your-website/cms": minor
---

Show real-shaped external data in the CMS route preview.

- `section-registry`: `derivePreviewSectionData(trees, locale, route?, registry?)`
  — a synchronous stand-in for `runQueries` with no invoker and no network.
  Each data-backed section on the page gets its spec's `previewSample`, run
  through the same `project` the shell uses; a spec with no `previewSample`
  (or one whose `project` rejects it) yields an error entry so the preview
  shows that section's real fallback.
- `cms`: `RoutePreview` derives `sectionData` with that helper (memoised on the
  draft tree) and passes it to `renderComposition`, so a `release-feed` node now
  previews its sample release list instead of the "unavailable" fallback.

Chosen over a `MemoryActionInvoker` + BFF round-trip: the preview re-renders on
every keystroke and has no real upstream, so a pure synchronous projection is
both simpler and avoids a stale-data flash while editing.
