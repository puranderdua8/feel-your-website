---
"@feel-your-website/action-core": minor
---

`@feel-your-website/action-core` gains its pure validators (still inert):

- `defineActions(defs)` → `ActionCatalog` (`byId` / `values` / `includes`).
  Throws at module load on a duplicate id, a `query` with an unsafe method or
  a `mutation` with a safe one, `cache` on a mutation, or `idempotent` /
  `confirm` on a query.
- `validateActionInput(def, body)` — delegates to `validateSectionFields`
  (`ActionInputSpec` is `SectionFieldSpec`, so the rules are written once).
- `validateActionBinding(def, mapping, { routeParamNames })` — every required
  input mapped, every mapped name real, every source allowed, every
  `routeParam` naming a param the route has.
- `findUnknownActionIds(catalog, ids)` — the ids not in the catalog, sorted.

`@feel-your-website/content-core` moves from a dev to a runtime dependency
(`validateActionInput` calls into it).
