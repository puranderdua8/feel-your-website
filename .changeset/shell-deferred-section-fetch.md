---
"@feel-your-website/shell": patch
---

Wire non-blocking section queries end to end (A23b).

- `loadRouteSectionData` takes a `phase` (`"blocking"` default / `"deferred"` /
  `"all"`): the SSR pass runs only `blocking` specs; a `blocking: false` spec is
  left for the client. `deferredSectionIds(page)` lists the non-blocking
  instance ids.
- `loadRoutePage` attaches `RoutePage.deferredSections`; a new `loadSectionData`
  server fn (GET, re-resolves the route from the pathname) runs just the
  deferred queries.
- `RoutePageView` renders skeletons for `deferredSections` on the first paint,
  fetches them in a mount effect, merges the result, and clears `pendingSections`
  — resetting per route. A failed fetch falls each section back to its own error
  state.

No section is non-blocking yet (`release-feed` stays `blocking` by default), so
this is inert in practice.
