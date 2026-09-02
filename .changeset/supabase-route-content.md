---
"@feel-your-website/content-adapter-supabase": minor
"@feel-your-website/config-bundle-supabase": minor
---

Persist and read route section content on the Supabase backend.

Migration `20260907000100_route_section_content.sql` adds a
`route_section_content` table — one row per (instance, locale), RLS mirroring
`route_section_instances`, `on delete cascade` from the instance so the
whole-tree replace in `save_route_composition` keeps working. The
`published_route_sections` view gains a `content` column that aggregates it
into a `locale -> fields` map, and `insert_route_section_nodes` now writes
each node's content rows as it inserts the instance.

`SupabaseContentAdapter.getRouteManifest` and
`SupabaseRouteCompositionReader.getComposition` fold that content onto each
`RouteSectionNode.content`, closing the gap the app-side inversion (PR #25)
opened: a route authored against Supabase now keeps its per-instance,
per-locale copy through a full save → reload.

Requires the migration to be applied to the hosted project
(`pnpm exec supabase db push`) and recorded in `supabase/migrations/applied.txt`.
