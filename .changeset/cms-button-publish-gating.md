---
"@feel-your-website/cms": patch
---

The CMS now checks `button` CTAs when saving and publishing a route.

- New pure `apps/cms/src/server/route-buttons.ts`: `firstUnsafeButtonHref(tree)`
  and `collectRouteButtonIssues(tree, { knownRoutePatterns })`.
- `saveRouteComposition` rejects any save — draft or not — whose tree contains
  a `link` button with an `unsafe` href (`javascript:` / `data:` /
  protocol-relative / …), the way it already rejects an unknown section key.
- `checkRoutePublishReadiness` adds a `structuralIssue` per button link
  problem: a missing href is **blocking**; an internal href that matches no
  published route pattern is a non-blocking warning.
