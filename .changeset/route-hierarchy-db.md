---
"@feel-your-website/content-adapter-supabase": minor
"@feel-your-website/config-bundle-supabase": minor
---

Make the route hierarchy real in Postgres (PR 2 of dynamic + nested routes).

- **New migration `20260911000100_route_params_and_hierarchy.sql`**:
  - `route_bundles` gains `parent_bundle_id` (self-FK, `on delete restrict`),
    `path_segment` (this route's own contribution — the stored source of truth),
    `normalized_path` (`:name` -> `:param`, `unique`, so two patterns matching
    the same URLs cannot coexist), and `param_meta`.
  - `save_route_composition` takes `p_path_segment` (replacing `p_path`) plus
    `p_parent_id` / `p_params`; it composes the absolute pattern from the
    parent, recomputes the whole subtree's paths (`route_recompute_subtree_paths`)
    so a parent rename is a one-row edit, and rejects self-parent, ancestor
    cycles, publishing a child under a draft parent, un-publishing a parent with
    a live child, and colliding patterns — all as `PT422`.
  - `delete_config_bundle` refuses a route that still has children; new
    `delete_route_subtree` deletes a route and its descendants leaf-first.
  - `published_route_sections` / `published_route_seo` expose the hierarchy
    columns; new slim `published_route_headers` view backs `getRouteHeaders()`.
  - Audit `snapshot` is unchanged; the authored path/parent/params go in a new
    `config_bundle_versions.snapshot_meta`.
- **`SupabaseContentAdapter`** reads the new columns, derives `pathSegment` via
  `splitSegment`, and now has a real `getRouteHeaders()` off
  `published_route_headers`. `getRouteManifest` retries without the hierarchy
  columns (and warns once) if the DB is a migration behind, so a code-ahead
  deploy degrades to flat routing instead of 500ing.
- **`SupabaseRouteComposition{Reader,Writer}`** carry `pathSegment` / `parentId`
  / `params` through; the writer sends the new RPC args and `deleteSubtree`
  calls `delete_route_subtree`. `mapRouteCompositionError` maps `PT422` / `23505`
  to the `"invalid"` code.

Requires the migration to be applied to the hosted project (`supabase db push`,
then record `20260911000100` in `applied.txt`).
