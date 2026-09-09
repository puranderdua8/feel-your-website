---
"@feel-your-website/shell": patch
"@feel-your-website/cms": patch
---

Document that deploys are manual and decoupled from GitHub.

Netlify's automatic build-on-push / build-on-PR is turned off for both sites via
the dashboard's "Stop builds" toggle; CI never triggers a deploy and no deploy
gates on CI. Merging a PR ships nothing on its own.

- New `docs/deployment.md` — one-time "Stop builds" setup, the two manual release
  paths (local build + drag-and-drop, or dashboard "Trigger deploy"), per-site
  environment variables, and rollback via Netlify's deploy history.
- New short `CONTRIBUTING.md` pointing at it.
- `README.md` gains a Deployment section.
- Both `netlify.toml` files and `infra/netlify.tf` gain comments recording that
  auto-deploy is intentionally off and that applying the Terraform does not
  re-enable it.

No code or build-behaviour change.
