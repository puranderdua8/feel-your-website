---
---

Add `pnpm deploy:shell` / `pnpm deploy:cms` — each runs the same filtered
`turbo run build` a Netlify build would run, then prints the `dist/client` path
to drag onto that site's Netlify Deploys tab. No Netlify CLI; build-and-print
only. Supports the manual-deploy flow in `docs/deployment.md`.

Repo tooling only — no package changes.
