---
"@feel-your-website/content-core": major
"@feel-your-website/section-registry": major
"@feel-your-website/content-adapter-memory": minor
"@feel-your-website/config-bundle-supabase": patch
---

Move content ownership from sections to route instances.

A section is a container. It renders whatever its route hands it — so the
same section placed on two routes, or twice on one route, now has two
independent content bags and there is no shared "global" content behind them.

`@feel-your-website/content-core`

- `RouteSectionNode` gains `content: Record<Locale, Record<string, JsonValue>>`
  — the instance's own copy, per site locale.
- `SectionSlotSpec.default` and `collectEffectiveRefs` are gone; an empty slot
  renders nothing, and publish-completeness is checked per node instance, not
  per de-duplicated ref. New `flattenNodes(tree)` returns the pre-order node
  list that check walks.
- `FlatSectionRow` carries optional per-locale `content`, which
  `assembleSectionTree` folds onto each node (defaulting to `{}`).
- `SectionRef.variant` is now vestigial (always `""`), documented as such;
  the `content_items` read path and `ContentWriter`'s item methods are dead
  code the B6 cleanup removes.

`@feel-your-website/section-registry`

- `renderComposition(tree, locale)` — no more `resolveContent` callback; each
  node's content is read straight off the node for the given locale, with no
  fallback to another locale.
- `renderSection(key, fields, slots)` takes a field bag, not a `Content`.
  `renderTemplate` (long deprecated) is removed.

`@feel-your-website/content-adapter-memory`

- Seed route trees carry inline per-instance content; the `/help` fixture's
  copy now lives on its node in both locales.

`apps/shell` renders a route from the manifest tree alone — `loadRoutePage`
does one lookup with no content fan-out. `apps/cms`'s route editor authors
each instance's content per locale, saved with the route; the Sections tab
(already a gallery) is unchanged.

Not included: Supabase persistence of per-instance content (the migration and
RPC changes land next, with `route_seo`), so a route authored against the
Supabase backend keeps its structure but not yet its per-instance copy.
