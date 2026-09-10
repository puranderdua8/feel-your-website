---
"@feel-your-website/content-adapter-memory": minor
"@feel-your-website/shell": minor
---

Make `release-feed` render end-to-end under `ACTION_INVOKER=memory`.

- `content-adapter-memory`: a new `/releases` fixture route — a `hero` plus a
  `release-feed` node. It is the example of a data-backed page, the way `/help`
  and `/blog` are the examples of static and nested ones.
- `shell` (`adapters.ts`): the `memory` action invoker now seeds `feed.releases`
  from the `release-feed` section's own `previewSample` (honouring the request's
  `limit`); every other action id still echoes its body. With the default
  (`none`) invoker the section shows its "unavailable" fallback and the page
  still renders — both paths covered by `release-feed.e2e.test.ts`.

Visiting `/releases` with `CONTENT_ADAPTER=memory ACTION_INVOKER=memory` now
shows the seeded release list; the `[actions] N query call(s) …` timing line
confirms the `loadRoutePage` fan-out ran.
