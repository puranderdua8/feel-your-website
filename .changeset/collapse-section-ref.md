---
"@feel-your-website/content-core": major
"@feel-your-website/content-adapter-supabase": patch
"@feel-your-website/config-bundle-supabase": patch
---

Collapse `SectionRef` into a bare `sectionKey`.

Content was never keyed by variant — it lives on the route instance — so
`SectionRef` (`{ key, variant }`) was a one-field type in a two-field shape.

- `RouteSectionNode.ref` is now `RouteSectionNode.sectionKey: string`; the
  `SectionRef` type is removed.
- `findUnknownSectionRefs` → `findUnknownSectionKeys` (takes/returns strings,
  de-duplicated and sorted).
- `flattenTree` returns `readonly string[]` (the section keys), not
  `SectionRef[]`.
- `FlatSectionRow` drops `sectionVariant`.
- Migration `20260910000100_route_section_node_key.sql`: `insert_route_section_nodes`
  reads `sectionKey` from the tree jsonb and writes `section_variant = ''`
  (the column stays, always empty, droppable later). The Supabase adapters
  stop selecting `section_variant`.

Requires the migration to be applied to the hosted project
(`pnpm exec supabase db push`) and recorded in `supabase/migrations/applied.txt`.
