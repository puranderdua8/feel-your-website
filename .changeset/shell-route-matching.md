---
"@feel-your-website/shell": minor
"@feel-your-website/content-adapter-memory": patch
---

The shell resolves routes through the pattern matcher (PR 4 of dynamic +
nested routes).

- **`loadRoutePage`** is now a thin wrapper over the pure
  `src/server/resolve-route-page.ts`: `normalizeRequestPath` →
  `matchRoute` (trie, static beats `:param`) → `resolveParentChain` → param
  sanitising → `interpolateSeo`. `RoutePage` gains `pathname`, `params`,
  `pattern`, `chain` (breadcrumbs) and `layers` (the root-first nested render
  stack); `path`/`tree` are gone.
- **`src/components/route-page.tsx`** folds `layers` innermost-first — each
  parent layout wraps the next through its `outlet` node — and publishes the
  route context to every section. `$.tsx` and `index.tsx` both use it;
  `index.tsx` (`/`) now renders a CMS route published at `/`, falling back to
  the built-in home.
- **`src/reserved-paths.ts`** — `/admin` (and any future static file route) is
  refused by the matcher and, later, blocked in the CMS. `reserved-paths.test.ts`
  keeps the list in sync with `routeTree.gen.ts`.
- Param values are decoded once and rejected (→ `notFound()`) if they carry a
  separator, control char, dot segment or surviving `%`.
- `content-adapter-memory`'s `/blog` fixture gains an `outlet` node so the
  nested `/blog/:slug` renders inside it.

Verified end-to-end against local Supabase: `/blog/:slug` renders the child
inside the parent layout, `<title>` and `canonical` interpolate `{{slug}}`,
`/blog/x/` normalises to `/blog/x`, and unmatched paths 404.
