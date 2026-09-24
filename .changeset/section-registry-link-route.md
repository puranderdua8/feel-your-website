---
"@feel-your-website/section-registry": minor
---

CMS-authored links now carry a router-ready target.

- **`classifyHref`** returns a `route: { pathname, search, hash }` for an
  internal `/…` link (normalised path, raw `?query`, fragment without `#`).
  A same-page `#fragment` / `?query` stays `internal` with no `route`.
- **`LinkSpec.route`** (new, optional) — `ButtonSection` passes it to the
  host's `renderLink`, so a host can hand it straight to its router's `<Link>`.
- **`validateButtonSection`** — an internal href that is still a route pattern
  (`/blog/:slug`) now blocks publish; a new `deployedRoutePatterns` context adds
  a non-blocking warning for a link to a route not yet in the deployed build;
  `/` and reserved shell paths are never flagged.
