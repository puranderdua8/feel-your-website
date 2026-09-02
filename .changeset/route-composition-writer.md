---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": minor
---

Add the write path for nested route section trees.

`@feel-your-website/content-core`:

- **`RouteCompositionWriter`** — one method, `saveComposition(bundleId,
input, expectedVersion, actor)`: creates (`bundleId: null`) or replaces a
  route bundle's whole section tree, returning the saved `RouteBundle`. Kept
  out of both `ContentAdapter` and `ConfigBundleStore` so neither contract
  grows a tree method.
- **`RouteCompositionError` / `RouteCompositionConflictError`** in `errors.ts`
  (`not_found` / `conflict` / `forbidden` / `unavailable`) — its own
  vocabulary rather than a dependency on `config-schema`.
- **`route-composition-contract-tests`** — a new build entry: create, nested
  round-trip, in-place version bump, stale-version conflict, unknown id.

`MemoryContentAdapter` now also implements `RouteCompositionWriter` over its
one mutable seed, and passes that contract.

`@feel-your-website/config-bundle-supabase` gains
**`SupabaseRouteCompositionWriter`**, calling the new
`save_route_composition` RPC (migration `20260904000100`) — a `SECURITY
DEFINER` function that reuses `write_bundle_header` for the version check and
audit row, records the tree in `config_bundle_versions.snapshot`, and walks
the jsonb tree with a recursive PL/pgSQL helper (`insert_route_section_nodes`)
that inserts each client-minted `instanceId` as the row id in one pre-order
pass. `route_templates` and the flat `items` list are refreshed from the
pre-order flatten so both models stay consistent until the B5 cleanup. A
live test in `config-bundle-supabase` exercises it end to end.
