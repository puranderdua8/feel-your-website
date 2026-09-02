---
"@feel-your-website/content-core": major
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/content-adapter-supabase": patch
"@feel-your-website/config-bundle-supabase": patch
---

Drop `RouteBundle.items`.

The deprecated pre-order flatten of `RouteBundle.tree` — a transition shim
since the section-tree model landed — is removed, along with its generic
`<TKey>` parameter (now meaningless). Every consumer already reads `tree`;
`flattenTree(tree)` derives the key list where one is still wanted (the
`save_route_composition` audit row, tests). Contract-suite assertions that
checked `items` mirrored `tree` are dropped or rephrased against `tree`.

Also tidies two stale `@puranderdua8/*` references in `pnpm-workspace.yaml`
left from the pre-`@feel-your-website` package scope.
