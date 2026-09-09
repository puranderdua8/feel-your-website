---
"@feel-your-website/section-registry": minor
---

`@feel-your-website/section-registry` gains `classifyHref(raw)` — the pure
classifier a CTA uses to decide between an internal route link, an external
link, and refusing to render. It is the XSS guard for CMS-authored hrefs:

- leading `/` (not `//`), `#`, or `?` → `internal` (path run through
  `normalizeRequestPath`, query/fragment preserved)
- an absolute `http` / `https` / `mailto` / `tel` URL → `external`
- everything else — `javascript:`, `data:`, `vbscript:`, `//host`, a bare
  relative path, a non-string, an empty value → `unsafe` (render a disabled
  placeholder)

Nothing uses it yet.
