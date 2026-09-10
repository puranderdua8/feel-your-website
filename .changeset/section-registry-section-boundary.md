---
"@feel-your-website/section-registry": minor
---

Add `<SectionBoundary>` and `RenderCompositionOptions.onSectionInView`. Inert —
no host passes the callback yet.

- `section-boundary.tsx` — `<SectionBoundary instanceId sectionKey onInView?>`:
  SSR-transparent (just a `<div data-section-instance data-section-key>` on the
  server), it reports the first time the section is ≥25% visible. **One**
  `IntersectionObserver` shared across every boundary on the page, created
  lazily in a client `useEffect`; a section stops being observed the moment it
  fires. No `IntersectionObserver` (old browser) → reported on mount.
  `resetSectionObserver()` is a test seam.
- `renderComposition` wraps each top-level section (never the outlet) in a
  `<SectionBoundary>` when `onSectionInView` **and** `route` are both set; with
  neither, sections render unwrapped as before — no extra DOM in the CMS
  preview.
- `purity.test.ts` picks the new file up automatically and it passes (no
  `"use client"`, no `fetch`, no forbidden imports).
