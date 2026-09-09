---
---

CI `verify` job now uploads `apps/shell/dist/client` and `apps/cms/dist/client`
as a `dist-client` workflow artifact (7-day retention). With Netlify Deploy
Previews turned off (manual deploys — see `docs/deployment.md`), this gives a
reviewer the built output to download from the run summary.

CI config only — no package changes.
