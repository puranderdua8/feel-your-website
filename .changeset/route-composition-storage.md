---
"@feel-your-website/content-adapter-supabase": patch
---

Persist the route section tree, and read it back from Supabase.

New migration `20260903000100_route_composition.sql`:

- **`route_section_instances`** — flat storage for a route bundle's section
  tree (self-FK with `on delete cascade`, `check` that root ⇔ no parent/slot,
  `unique nulls not distinct (bundle_id, parent_instance_id, parent_slot,
ordinal)`), RLS mirroring `route_templates` (published via parent bundle,
  drafts for `manage:routes`).
- **`published_route_sections`** — `security_invoker` read model: one row per
  instance of a published route.
- **`config_bundle_versions.snapshot jsonb`** — nullable; the audit trail can
  carry the tree as authored.
- `save_route_bundle` now also mirrors its flat item list into root
  `route_section_instances` (it still writes `route_templates`, so
  `SupabaseConfigBundleStore` is untouched), plus a backfill of existing
  `route_templates` rows.

`SupabaseContentAdapter.getRouteManifest` reads `published_route_sections`
and calls the shared `assembleSectionTree` — no recursive CTE, same
tree-building as the memory adapter. `items` is derived via `flattenTree`.

The RPC that writes a genuinely nested tree (`save_route_composition`) and
the `RouteCompositionWriter` that calls it are the next phase.
