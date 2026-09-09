---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": patch
---

Second of three PRs for first-class route layouts: the database enforces the
two layout invariants, the same way it already enforces cycles and publish
ordering.

- **`route_bundles.has_outlet`** — a new `boolean not null default false`
  column (migration `20260912000100`). `save_route_composition` **derives** it
  from the `route_section_instances` rows it just wrote (it never trusts a
  caller flag) and stores it; the migration backfills existing rows.
- **`save_route_composition` now raises `PT422` (→ `"invalid"`) for:**
  1. publishing a route while its parent has `has_outlet = false` — the child
     would have nowhere to render inside the parent;
  2. saving a route with no outlet while it has a published child — that would
     strand the child.
     Draft children are unaffected; the checks sit right after the existing
     publish-ordering checks and mirror them.
- **`RouteCompositionSummary.hasOutlet` is now required.**
  `SupabaseRouteCompositionReader` reads `has_outlet` (both `listCompositions`
  and `getComposition`); `MemoryContentAdapter.saveComposition` mirrors both
  `PT422` checks so the shared contract stays meaningful.
- New coverage: `route-composition-contract-tests.ts` (memory) — can't publish
  a child under an outlet-less parent, can once the parent gains one, can't
  drop an outlet under a published child; `config-bundle-supabase/live.test.ts`
  — the same against a real Postgres, plus `has_outlet` is stored and an
  `outlet` node round-trips through `route_section_instances`.
