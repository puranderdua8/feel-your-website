---
"@feel-your-website/cms": minor
---

Third and last PR for first-class route layouts: the CMS enforces the two
layout invariants and guides the author to a fix, so nested routes actually
nest instead of silently rendering standalone.

- **`validateRouteInput`** blocks publishing a route whose parent has no
  outlet (client-side, live, no round trip); **`saveRouteComposition`** is the
  authority for that plus "a route with a published child must keep its
  outlet" (`countOutlets(tree)` + the real sibling set); the `20260912000100`
  RPC is the transactional backstop.
- **`checkRoutePublishReadiness`** gains `hasPublishedChildren` and
  `parentHasOutlet` inputs and surfaces both rules as blocking `⛔` structural
  issues; "has child routes but no outlet yet" is a non-blocking nudge.
- **`section-tree.tsx`**: "+ Add outlet" is offered on _any_ route without one
  (a route can be set up as a layout before it has children), emphasised once
  children exist — the old "only when it has children" gate is gone.
- **`route-editor/index.tsx`**: an inline warning when the chosen parent has
  no outlet, with a one-click **"Add an outlet to `<parent>`"** — a normal
  single-route save of the parent (its content / SEO / params / `published`
  state preserved, version bumped, conflicts surfaced) — and a banner on a
  route that has children but no outlet.
- README updated for the strict layout rule.

Verified end to end against the memory adapter: a child under an outlet-less
`/home` is blocked from publishing (button disabled + `⛔`), one click adds the
outlet to `/home` (still published, `/home/about` untouched), the child then
publishes, and removing `/home`'s outlet while `/home/about` is published is
refused by both the readiness check and the save.
