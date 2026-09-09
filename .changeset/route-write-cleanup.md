---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": patch
"@feel-your-website/cms": patch
---

Route-write housekeeping — drop the deprecated compat surface and tighten the
shared contract.

- **`RouteCompositionInput.path` removed.** `pathSegment` (+ `parentId`) is now
  the sole, required path input; the `pathSegment ?? path` fallbacks in both
  writers and the `composeCandidatePath` guard in the CMS BFF are gone.
  `saveComposition` still returns the derived absolute `path` on the bundle,
  and `RouteCompositionSummary.path` is unchanged.
- **The 8-arg `save_route_composition` wrapper is dropped** (migration
  `20260913000100`) — the bridge kept beside the 10-arg form in
  `20260911000100`. The deployed CMS calls the 10-arg form.
- **`route_section_instances.section_variant` is dropped** — always `''` since
  `20260910000100` collapsed the `SectionRef` wrapper. The column, its use in
  `published_route_sections`, and its write in `insert_route_section_nodes` go
  with it.
- **`runRouteCompositionWriterContract` gains an optional `readerFor(writer)`.**
  When supplied, the shared suite adds read-back assertions — currently that
  `hasOutlet` on the summary reflects the saved tree — so they run against
  every backend on the contract, not just the memory adapter's own file.

Migration `20260913000100` needs applying to the hosted project (`supabase db
push` + `applied.txt`); the `migrations` check is red until then. `verify` and
`supabase` (local reset + both live suites) pass.
