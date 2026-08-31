# feel-your-website

A reusable platform boilerplate. Its premise is that three things which are
normally fixed at code time are instead configurable at runtime:

| Concern               | Configurable                                    | Fixed in code                                            |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| **RBAC**              | Roles, and which permissions each role holds    | The permission catalog itself                            |
| **Content & routing** | What copy appears in which slot, per locale     | The template vocabulary, and the rendering logic         |
| **Multi-step flows**  | Step order, content, which validator runs where | The validators themselves, and every irreversible effect |

Products are built by cloning this repo, not by installing it.

## Stack

| Layer         | Choice                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| App framework | TanStack Start (React 19, Vite 8)                                              |
| Hosting       | Netlify — TanStack Start's official deployment partner                         |
| Backend       | Supabase — Postgres, Auth, Storage, Realtime                                   |
| Styling       | Tailwind v4 + `@puranderdua8/theme`                                            |
| Components    | `@puranderdua8/registry` via `npx shadcn add` (source, not a package)          |
| i18n          | `use-intl`, with all copy served from the CMS                                  |
| IaC           | Terraform (Supabase project, Netlify site) + Supabase CLI (schema, RLS, hooks) |

Everything runs on free tiers.

## Getting started

Requires Node 22.13+ (see `.nvmrc`) and pnpm 11.

`@puranderdua8/tokens` and `@puranderdua8/theme` come from GitHub Packages, so
you need a personal access token with `read:packages`. It goes in your
user-level `~/.npmrc` — pnpm refuses to expand env vars in credentials read
from a committed project `.npmrc`, so this cannot live in the repo:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" <your-pat>
```

```bash
pnpm install
```

## Scripts

| Command               | Does                                |
| --------------------- | ----------------------------------- |
| `pnpm build`          | Build every package and app         |
| `pnpm dev`            | Run all apps in watch mode          |
| `pnpm lint`           | ESLint across the workspace         |
| `pnpm typecheck`      | `tsc --noEmit` across the workspace |
| `pnpm test`           | Unit tests                          |
| `pnpm test:contracts` | Adapter contract suites             |
| `pnpm format`         | Prettier write                      |
