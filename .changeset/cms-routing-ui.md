---
"@feel-your-website/cms": minor
---

The dedicated routing UI (PR 6 of dynamic + nested routes).

- **New `apps/cms/src/server/route-input.ts`** (pure, bundles into the browser
  too): `validateRouteInput` — the single source of every path/hierarchy/param/
  SEO rule this platform enforces, run both by the editor's live preview (no
  round trip) and by `saveRouteComposition` (the authority). `composeCandidatePath`,
  `parseParams`, `isReservedRoutePath` (kept in sync with, but not read from,
  `apps/shell/src/reserved-paths.ts` — separately deployed apps).
- **`route-editor/`** gains: `path-builder.tsx` (edit this route's own segment(s)
  as static-text or `:param` chips; a nested route's parent pattern shown
  locked), `param-editor.tsx` (a label per `:name` the path actually contains),
  `parent-picker.tsx` (a route's hierarchy, excluding itself and its own
  descendants), `route-hierarchy.tsx` (`buildRouteForest` / `walkForest` /
  `descendantIds`, shared by the picker and the now-hierarchical `route-list.tsx`),
  `path-pattern-preview.tsx` (the composed pattern, a sample URL, and every live
  validation issue).
- **`seo-panel.tsx`** gains per-field `{{param}}` insert chips and flags a
  placeholder that isn't one of the route's own parameters.
- **`section-tree.tsx`** gets a dedicated "Add outlet" control — shown only
  while the route has children, hidden once one exists; `outlet` is still not a
  `sectionCatalog` entry, so it never appears in the generic add-section list.
- **`saveRouteComposition`** validates with `validateRouteInput` and rejects a
  tree with more than one outlet; new **`deleteRouteSubtree`** server fn, wired
  to a confirm dialog that names every descendant it would remove.
  **`checkRoutePublishReadiness`** gains `structuralIssues` (blocking: a layout
  with no outlet; a colliding outlet count) alongside the existing per-locale
  gaps, and no longer flags the outlet marker itself as a content gap.

Verified end-to-end against a local session (`CONTENT_ADAPTER=memory`): parent
picker shows the real hierarchy, reparenting composes the child's pattern
live, a colliding `:id` sibling of `/blog/:slug` is blocked with a named
collision, a plain child route saves and appears nested with a "draft" badge,
subtree delete lists its descendants before confirming, and an SEO insert chip
appends `{{slug}}` to the title. Two bugs surfaced by that walkthrough are
fixed here: switching a route's parent left stale path text that composed to
an invalid pattern for a beat, and a brand-new child route could never get its
first segment (an empty single segment and zero segments serialise
identically) — both covered by new `path-builder.test.tsx` regressions.
