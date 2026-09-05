---
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": patch
"@feel-your-website/content-core": patch
"@feel-your-website/shell": patch
"@feel-your-website/cms": patch
---

Fixes for issues found reviewing the dynamic + nested routes work.

- **`MemoryContentAdapter.saveComposition` now rejects a rename/reparent that
  would drag a _descendant_ route's path onto an existing route.** The
  collision guard only checked the route being saved against every other
  route's current path — but moving a parent shifts every descendant's derived
  path too, so a rename whose own new path was fine could still silently
  produce two routes matching the same URLs. Postgres already catches this via
  `route_recompute_subtree_paths` inside a `unique_violation` trap; the memory
  adapter now mirrors it by recomputing the whole moved subtree's paths and
  checking each against every route outside it. Left unfixed, an ordinary
  parent rename in local dev could put the manifest in a state where
  `buildRouteTrie` throws `RoutePatternCollisionError` on every request. New
  shared contract test covers it against both backends.

- **`saveRouteComposition` (CMS BFF) now blocks publishing a layout route that
  has children but no `outlet`.** `checkRoutePublishReadiness` flagged this as
  a blocking issue, but it is an opt-in check the editor only runs on a button
  press and never on the save path, so Publish could go through with the
  button never disabled and the children rendering as chrome-less standalone
  pages. The rule is now enforced server-side on every publish (children
  computed from the sibling list, not trusted from the client), and
  `PublishBar` runs the readiness check automatically (debounced) instead of
  only when asked.

- **Breadcrumb fallback title no longer shows the raw `:name` token.** A
  param route with no SEO title fell back to the last _pattern_ segment, so
  `/blog/hello` produced a crumb reading `:slug`. It now resolves to the
  request's actual value (`hello`).

- **`SupabaseRouteCompositionWriter.saveComposition` reads the persisted
  hierarchy fields back** instead of echoing the client-computed `path`, which
  could be stale if another parent rename raced between the caller's sibling
  read and this write.
