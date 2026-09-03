---
"@feel-your-website/section-registry": minor
---

Add the route render context and the `outlet` marker (PR 3 of dynamic + nested
routes).

- **New `context.tsx`**: `RouteRenderContext` (`params`, `pathname`, `pattern`,
  breadcrumb `chain`, `locale`), `RouteRenderProvider`, and the hooks
  `useRouteRenderContext()` / `useRouteParams()` / `useRouteParam(name)`. Params
  are documented as untrusted URL input. `OUTLET_SECTION_KEY = "outlet"` — the
  reserved key that marks where a parent layout renders its matched child; it is
  deliberately not a `sectionCatalog` entry.
- **`renderComposition(tree, locale, options?)`** gains an options object:
  `route` (published via context and passed to every section as `props.route`)
  and `outlet` (what an `outlet` node renders — `null` for an empty child,
  omitted for a visible placeholder). Threaded recursively, so a nested `outlet`
  resolves too.
- **`SectionComponentProps`** gains an optional `route?: RouteRenderContext`;
  the nine built-in sections, which only read `fields`/`slots`, are unchanged.
  `renderSection` forwards it.

No behaviour change for existing callers — `renderComposition(tree, locale)`
still works exactly as before.
