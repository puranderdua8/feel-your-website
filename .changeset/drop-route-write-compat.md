---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": patch
"@feel-your-website/cms": patch
---

Drops the deprecated route-write compatibility surface, all of which prior
migrations flagged as removable once nothing used it:

- **`RouteCompositionInput.path`** — the free absolute-path field. Callers send
  `pathSegment` (+ `parentId`); it is now the only, required, path input, and
  the adapters no longer carry a `pathSegment ?? path` fallback. `saveComposition`
  still returns the derived absolute `path` on the bundle.
- **The 8-arg `save_route_composition` wrapper** (`20260913000100`) — the bridge
  kept around `20260911000100` for a non-lock-stepped deploy. The deployed CMS
  calls the 10-arg form.
- **`route_section_instances.section_variant`** — always `''` since the
  `SectionRef` wrapper was dropped in `20260910000100`. The column, its use in
  `published_route_sections`, and its write in `insert_route_section_nodes` are
  gone.

Migration `20260913000100` needs applying to the hosted project (`supabase db
push` + `applied.txt`); the `migrations` check stays red until then. `verify`
and `supabase` (local reset + live suites) pass.
