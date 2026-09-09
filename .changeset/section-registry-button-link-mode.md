---
"@feel-your-website/section-registry": minor
---

The `button` section becomes a proper CTA with a configurable link.

- **Schema** (`sections.ts`): `mode` (`link` | `action`, default `link`), `href`
  and `linkTarget` (`same-tab` | `new-tab`) shown only in `link` mode via
  `showWhen`. `href` is no longer schema-`required` — the conditional
  requirement moves to `validateButtonSection`.
- **`RenderCompositionOptions.renderLink`** + **`SectionComponentProps.renderLink`**
  — a host-injected `(spec: LinkSpec) => ReactNode`. `ButtonSection` calls it
  for a `link`; absent, it falls back to a plain `<a>` (with
  `target="_blank" rel="noopener noreferrer"` for a new tab). An `unsafe` href
  or `action` mode renders a disabled placeholder for now.
- **`validateButtonSection(fields, { knownRoutePatterns? })`** — publish-time
  checks: `link` mode needs a non-empty, non-`unsafe` href (blocking); an
  internal href matching no known route is a non-blocking warning.
- **`purity.test.ts`** — fails if the shared registry ever gains `"use client"`,
  a `fetch(`, or a runtime import of the router / a capability package.

`renderLink` is inert until the shell and CMS pass one.
