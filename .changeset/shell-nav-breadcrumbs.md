---
"@feel-your-website/shell": minor
---

Auto site-nav and breadcrumbs from the route hierarchy (PR 5 of dynamic +
nested routes).

- **`BootstrapPayload`** gains `nav: NavNode[]`. `loadBootstrap` builds it in
  `src/server/nav.ts`'s pure `buildNav()` from
  `getContentAdapter().getRouteHeaders()` — the section-tree-free read model, so
  the per-navigation bootstrap call stays cheap. Param routes (and their
  subtrees) are excluded from the menu; a child of an unpublished parent is
  promoted to a root. A CMS outage degrades to `nav: []`.
- **`src/components/site-nav.tsx`** — rendered in `__root.tsx` above `<Outlet/>`;
  top-level routes as links, a route with children as a dropdown.
- **`src/components/breadcrumbs.tsx`** — rendered by `RoutePageView` when the
  chain has more than one entry; last entry is the non-link current page.
- `RouteChainEntry` gains `href` (the concrete URL, params filled via
  `buildHref`) so breadcrumb links work on a parameterised route.
