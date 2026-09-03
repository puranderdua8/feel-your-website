---
"@feel-your-website/content-core": major
"@feel-your-website/content-adapter-memory": minor
"@feel-your-website/content-adapter-supabase": patch
"@feel-your-website/config-bundle-supabase": patch
---

Add the route path-pattern matcher and route-hierarchy model (PR 1 of dynamic +
nested routes).

- **New `route-match.ts`** (pure, no vendor / no vitest): `parseRoutePattern` /
  `validateRoutePattern` / `normalizePattern`; `composeAbsolutePattern` /
  `splitSegment` (relative segment <-> absolute pattern); `buildRouteTrie` /
  `matchRoute` / `matchRouteInTrie` — a segment trie walked depth-first,
  static-child before param-child, backtracking on a dead end, so precedence is
  structural; `normalizeRequestPath` / `buildHref`; `resolveParentChain` /
  `findParentCycle`; `interpolateTemplate` / `interpolateSeo` /
  `templatePlaceholders`; `paramMetaToRecord`; `findPatternCollisions`. New
  errors `RoutePatternError` / `RoutePatternCollisionError`.
- **`RouteBundle`** gains `pathSegment`, `parentId`, `paramNames`, `paramMeta`
  (new `RouteParamMeta`). `path` is now documented as an absolute *pattern*.
- **`ContentAdapter`** gains `getRouteHeaders()` (new `RouteHeader`) — a
  section-tree-free list for building site nav / breadcrumbs.
- **`RouteCompositionWriter`** gains `deleteSubtree()`. `RouteCompositionInput`
  gains optional `pathSegment` / `parentId` / `params` (new `RouteParamSpec`);
  `RouteCompositionSummary` gains `parentId` / `pathSegment`;
  `RouteComposition` gains `params`. New `RouteCompositionError` code
  `"invalid"`.
- **`MemoryContentAdapter`** derives each route's absolute pattern from its
  `pathSegment` and parent chain, and `saveComposition` / `deleteComposition`
  now enforce the hierarchy invariants (self-parent, ancestor cycle, publish
  top-down / unpublish bottom-up, structural-pattern collision, no plain delete
  of a route with children). `contractSeed` gains a nested `/blog` +
  `/blog/:slug` pair.
- The Supabase adapters carry the new fields through as flat / top-level
  values; migration `20260911000100` (PR 2) makes them real. No behaviour
  change to existing flows — the shell still resolves routes by exact match
  until PR 4.
