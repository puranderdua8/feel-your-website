---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/section-registry": patch
"@feel-your-website/cms": patch
"@feel-your-website/shell": patch
---

Groundwork for making route layouts first-class (PR 1 of 3). No behaviour
change.

- **`OUTLET_SECTION_KEY` now lives in `@feel-your-website/content-core`**, beside
  `RouteSectionNode` — "does this route's tree carry an outlet" is a
  content-model fact the adapters, the shell and the CMS all need to read the
  same way. `section-registry` re-exports it, so existing imports are
  unchanged. New pure helpers `treeHasOutlet(tree)` / `countOutlets(tree)`
  replace the three hand-rolled copies (`route-editor/tree-ops.ts`,
  `cms/src/server/bff.ts`, `shell/src/server/resolve-route-page.ts`).
- **`RouteCompositionSummary` gains `hasOutlet?: boolean`** — whether the route
  is a layout that can host a child. The memory adapter always sets it (on both
  `listCompositions` and `getComposition`); the Supabase reader picks it up
  with a `route_bundles.has_outlet` column in PR 2. New memory-adapter tests
  cover it, plus a regression test that publishing/unpublishing one route never
  touches any other route's `published` flag (verified live in the CMS too).
- **`help` is now a `sectionCatalog` entry** (same title/body shape and
  renderer as `guidance`). The memory fixtures' `/help` and `/blog/:slug`
  routes use it, so without this they could be rendered but not edited or
  re-saved in the CMS ("Unknown section(s): help").
