---
"@feel-your-website/shell": patch
"@feel-your-website/cms": patch
---

Wire the CTA link renderer.

- `apps/shell/src/components/cta-link.tsx` — `renderCtaLink`: an internal
  same-tab link (`/…`) becomes a client-side transition (`router.history.push`
  on a plain left-click, modifier/middle clicks left alone); external links,
  new-tab links, and fragment/query hrefs are plain `<a>` with
  `rel="noopener noreferrer"` when `target="_blank"`. `RoutePageView` passes it
  as `renderLink`.
- `apps/cms` route preview passes a plain-`<a>` renderer (no router in the
  preview).

CTA links now work end to end: internal (client transition), external,
same-tab, and new-tab, all authored from the `button` section.
