# Deployment

Deploys are **manual**. Netlify's automatic build-on-push / build-on-PR is turned
**off** for both sites, and nothing in this repo re-enables it. This keeps the
project inside the Netlify free tier's build-minute budget and decouples shipping
from merging.

- CI (`.github/workflows/ci.yml`) runs on every push and PR and is completely
  independent of Netlify — it never triggers a deploy and no deploy gates on it.
- There are **two Netlify sites**, one per app, both pointed at this repo. Each
  has its own nested `netlify.toml` (`apps/shell/netlify.toml`,
  `apps/cms/netlify.toml`) and its own dashboard **Package directory** setting.
  See the comment at the top of either `netlify.toml` for why neither lives at
  the repo root.

## One-time setup (per site)

In the Netlify dashboard, for **each** site (`shell` and `cms`):

1. **Site configuration → Build & deploy → Continuous deployment**.
2. Click **Stop builds**.

That disables push builds, branch-deploy builds, and Deploy Previews for PRs
while leaving the site, its custom domain, and its environment variables intact.
"Start builds" in the same place reverses it — do not click it without updating
this document.

> Losing Deploy Previews means PRs no longer get a preview URL. As a partial
> substitute, the CI `verify` job uploads each app's built `dist/client` as a
> workflow artifact you can download from the run's summary page.

## Releasing a new version (per site)

### Option A — build locally, drag-and-drop

Requires Node `22.23.2`+ (see `.nvmrc`) and pnpm `11`.

```bash
pnpm install --frozen-lockfile

# shell
pnpm deploy:shell     # → builds, prints the path to apps/shell/dist/client

# cms
pnpm deploy:cms       # → builds, prints the path to apps/cms/dist/client
```

Then in the Netlify dashboard for that site: **Deploys** tab → drag the printed
`dist/client` folder onto the drop zone. This publishes a static deploy of
exactly what you built — Netlify runs no build of its own.

`pnpm deploy:shell` / `pnpm deploy:cms` only build and print the folder path;
they do not talk to Netlify.

### Option B — Netlify builds from git on demand

In the Netlify dashboard for that site: **Deploys** tab → **Trigger deploy** →
**Deploy site**. Netlify fetches the current `main`, runs the `command` from that
site's `netlify.toml`, and publishes. This is still fully manual (nothing fires
it but you) and uses one build-minute quota slice.

Use Option A when you want to ship a specific local build or avoid spending build
minutes; Option B when you want Netlify to build a clean checkout of `main`.

## Environment variables (per site)

Set in the Netlify dashboard: **Site configuration → Environment variables**.
Each site is configured independently — one `netlify.toml` does not wire the
other's env.

| Variable                    | shell                  | cms                    | Notes                                                                                                                       |
| --------------------------- | ---------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `CONTENT_ADAPTER`           | `memory` \| `supabase` | `memory` \| `supabase` | Defaults to `memory` (no backend needed).                                                                                   |
| `AUTH_PROVIDER`             | `mock` \| `supabase`   | `mock` \| `supabase`   | The `cms` site **must** be `supabase` before it is publicly reachable — `mock` exposes an all-permissions backdoor account. |
| `SUPABASE_URL`              | if `supabase`          | if `supabase`          | Safe to expose.                                                                                                             |
| `SUPABASE_ANON_KEY`         | if `supabase`          | if `supabase`          | Safe to expose; RLS protects the data.                                                                                      |
| `SUPABASE_SERVICE_ROLE_KEY` | —                      | —                      | Server-only; not read by either app at runtime (contract tests only). Never prefix `VITE_`.                                 |

Later features add more (`ACTION_*`, `ANALYTICS_*`) — those are documented in
`.env.example` as they land.

## Rollback

Netlify keeps every published deploy. In the site's **Deploys** tab, open an
older deploy and click **Publish deploy** to roll back instantly. No rebuild.

## Infrastructure note

`infra/netlify.tf` is written but never applied (see `infra/README.md`). If it is
ever applied, it does **not** re-enable automatic deploys — `production_branch`
alone does not control that; the "Stop builds" toggle does.
