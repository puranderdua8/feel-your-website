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

## Two rules that make it reusable

**1. No app imports a concrete backend.** Apps depend on the `content-core`,
`auth` and `config-schema` interfaces only; the implementation is injected
once at server start. This is what lets the backend be swapped for Strapi,
Sanity or something bespoke without touching screen code.

**2. No hard-coded copy.** All user-facing text comes from the CMS through the
BFF, with a small bootstrap bundle for what must render before the CMS
answers.

## Contract suites

Three packages export an executable contract every implementation must pass:
`content-core`, `auth` and `config-schema`. They are separate build entry
points, never re-exported from the barrel, so `vitest` cannot reach an
application bundle.

Matching method signatures is not substitutability. TypeScript will happily
accept an adapter that throws where another returns `null`, or paginates by
offset where another uses cursors — and every call site then has to know which
one it is talking to. The contracts pin the behaviour that actually differs:
error shape, pagination semantics, locale fallback, and idempotency.

`pnpm test:contracts` runs them. A new adapter is finished when it passes.

## Permissions: what's code and what's data

|                                          | Where it lives                 | How often it changes                            |
| ---------------------------------------- | ------------------------------ | ----------------------------------------------- |
| **Permission catalog** — the vocabulary  | TypeScript, in `packages/rbac` | Rarely — only when a developer ships a new gate |
| **Roles** — named bundles of permissions | Database, authored in the CMS  | Freely                                          |
| **User → role assignment**               | Database                       | Freely                                          |

A permission means something _only_ because a `<Can permission="…">` or a BFF
check exists in code. Creating one in a database would grant nothing and
protect nothing, so the catalog is deliberately not editable as data.

The catalog is mirrored into a Postgres `permissions` table by a generated
seed so `role_permissions` can carry a foreign key. Code is authoritative;
the table is a derived copy. **If you change the catalog, regenerate the
seed** — `assertSeedMatchesCatalog()` fails CI if you forget. Role CRUD, the
frequent operation, carries none of this risk: roles are pure data with no
mirror.

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
