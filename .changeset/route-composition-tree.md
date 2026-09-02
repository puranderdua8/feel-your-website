---
"@feel-your-website/content-core": minor
"@feel-your-website/section-registry": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/content-adapter-supabase": patch
---

Model routes as a section-instance tree.

`@feel-your-website/content-core` gains `RouteSectionNode` (an instance: a
`SectionRef` plus per-slot children) and a `compose` module —
`assembleSectionTree()` (flat rows → tree, in TypeScript, never a recursive
CTE), `flattenTree()` (pre-order list of the refs present), and
`collectEffectiveRefs()` (those refs plus the declared default of every
required slot left empty — the list a publish gate iterates). `RouteBundle`
now carries `tree`; `items` stays as a deprecated pre-order flatten for the
transition and is dropped in the B5 cleanup.

`@feel-your-website/section-registry` exports `renderComposition(tree,
resolveContent)` — recurses slots, materialises an unfilled slot's default at
render time. Section components share one `{ fields, slots }` shape so
`card` can place its `icon` / `body` slot children; `renderSection` replaces
`renderTemplate` (kept as a deprecated alias).

Both content adapters return `RouteBundle.tree`: the memory adapter from a
tree-first seed (`items` derived), the Supabase adapter by lifting today's
flat `published_route_manifest` rows into a roots-only tree. Persisting a
real nested tree (the `route_section_instances` migration,
`published_route_sections` view, `save_route_composition` RPC and
`RouteCompositionWriter`) is the follow-up phase; no schema changes here.

`apps/shell` renders the catch-all route via `renderComposition`;
`loadRoutePage` batch-fetches content for every ref in `collectEffectiveRefs`.
