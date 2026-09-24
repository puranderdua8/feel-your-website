---
"@feel-your-website/shell": patch
"@feel-your-website/cms": patch
---

Every in-app link in the shell is now a TanStack `<Link>`, so navigation is a
client-side transition instead of a full page load.

- **shell**: new `AppLink` (runtime-path `<Link>`; query parsed with the
  router's own `parseSearch` so authored URLs round-trip exactly). Used by the
  site nav, breadcrumbs, and CTA renderer — which also gains intent preload and
  `aria-current="page"` on the active nav entry.
- **shell**: new `RouteAnnouncer` (mounted in `__root`) — after each
  client-side navigation to a new path, focus moves to the new page (the
  `#fragment` target, else its `h1`, else `<main>`) and `document.title` is
  announced in a polite live region, restoring what a full page load gave
  keyboard and screen-reader users for free.
- **cms**: publish readiness checks CTA links against the deployed shell's
  `build-info.json` routes (`DeployStatus.routePaths`); the deploy-status fetch
  now times out after 3s. Route-preview CTA links no longer navigate the editor
  away (and show their target on hover).
