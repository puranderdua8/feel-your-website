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

Everything runs on free tiers. See the implementation plan for the cost model.

## Two rules that make it reusable

**1. No app imports `supabase-js`.** Apps depend on the `content-core`,
`auth` and `config-schema` interfaces only; the concrete adapter is injected
once at server start. This is what lets Supabase be swapped for Strapi, Sanity, or a
bespoke backend without touching screen code. Contract tests in each
interface package define what "a valid implementation" means, and every
adapter must pass the same suite.

**2. No hard-coded copy.** All user-facing text comes from the CMS through
the BFF. The one exception is a small bootstrap bundle covering what renders
before the CMS answers or when it is unreachable on a cold cache — loading,
offline, error boundaries. CMS copy overrides it the moment it loads.

## Language: a cookie, not a URL

Locale is a **per-user preference carried in a cookie**. It never appears in
the address, and there is no per-locale route duplication.

|                 |                                                                                 |
| --------------- | ------------------------------------------------------------------------------- |
| Stored in       | Cookie `locale`, one year, `Path=/`, `SameSite=Lax`, not `httpOnly`             |
| Written by      | The `setLocale` server function, so the write is authoritative                  |
| Resolved by     | `cookie → Accept-Language → en`                                                 |
| Reaches the BFF | Automatically — the cookie rides every request, including server-function calls |

**Why a cookie rather than `localStorage`.** This is a correctness
constraint, not taste. The server renders the first frame and must know the
language _at request time_. `localStorage` does not exist on the server, so a
choice stored only there means the server always renders English and the
client corrects it after hydration — a visible flash of the wrong language
and a hydration mismatch. A cookie arrives with the request, so the first
byte of HTML is already correct. Verified: with `Cookie: locale=hi`, the
server's own HTML contains `<html lang="hi">` and Hindi copy.

Because the cookie is sent with every request, there is no call site that can
forget to pass the locale and silently serve English. Server functions
resolve it through one shared helper rather than each taking a parameter.

**The trade:** a URL is no longer shareable _in a particular language_ —
send someone a link and they see it in whatever language they chose. For an
authenticated app where each user works in one language that is the right
default. A public marketing site would want the opposite.

### Swapping to URL-based locale

That opposite is a **one-directory change**. Everything about where the
locale comes from and how a choice is persisted lives in `apps/shell/src/i18n/`:

| File                 | Owns                                                           |
| -------------------- | -------------------------------------------------------------- |
| `config.ts`          | Which locales exist. Strategy-independent                      |
| `strategy.server.ts` | Resolving the locale for a request; persisting a choice        |
| `strategy.ui.ts`     | Router options the strategy needs; what "switch language" does |

To move locale into the URL: pass `pathname` to `negotiateLocale` (it already
accepts one), make `persistLocale` a no-op, return a `rewrite` pair from
`routerLocaleOptions`, and make the switch a navigation. The `i18n-core`
primitives for both strategies — `extractLocaleFromPath`, `localizePath`,
and `negotiateLocale`'s URL source — already exist, so no package changes
either way.

Nothing else moves. The BFF asks for a locale, the switcher reports which one
the user picked, and the router spreads whatever options it is handed —
none of them know the mechanism. `strategy.test.ts` enforces this: it fails,
naming the file, if a mechanism token (`LOCALE_COOKIE`, `localStorage`,
`localizePath`, …) appears anywhere outside `src/i18n/`.

One naming gotcha it also pins: do not call that second file
`strategy.client.ts`. `*.client.*` is reserved by TanStack Start and denied
in the server bundle, and `router.tsx` imports it while running on both
sides.

## Permissions: what's code and what's data

This split is the thing to understand before reusing this template.

|                                                               | Where it lives                 | How often it changes                            |
| ------------------------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| **Permission catalog** — the vocabulary (`manage:content`, …) | TypeScript, in `packages/rbac` | Rarely — only when a developer ships a new gate |
| **Roles** — named bundles of permissions                      | Database, authored in the CMS  | Freely, by whoever holds `manage:roles`         |
| **User → role assignment**                                    | Database                       | Freely                                          |

A permission means something _only_ because a `<Can permission="…">` or a BFF
check exists in code. Creating one in a database would grant nothing and
protect nothing, so the catalog is deliberately not editable as data.

### The one caveat: catalog drift

The catalog is mirrored into a Postgres `permissions` table by a generated
seed, so `role_permissions` can carry a foreign key and RLS can join against
it. Code is authoritative; the table is a derived, one-directional copy.

Two copies can disagree. **If you change the catalog, regenerate the seed.**

- Forget after _adding_ a permission → the foreign key rejects it and nobody
  can grant it. Annoying, but loud.
- Forget after _removing_ one → the row lingers, the role editor still offers
  it, and an admin can tick a box that silently does nothing. This is the
  failure worth knowing about, because nothing breaks visibly.

Three guards exist, and it is worth knowing what each does **not** cover:

| Guard                                      | Covers                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `assertSeedMatchesCatalog()` in CI         | Code ↔ the committed seed file                                                        |
| Startup check                              | Seed file ↔ the **running database** — CI cannot see a deploy that skipped migrations |
| Table grants limited to the migration role | Out-of-band edits via SQL or Supabase Studio                                          |

**Role CRUD carries none of this risk.** Roles are pure data with no mirror.
Only catalog changes — the rare, developer-initiated ones — need the seed
regenerated.

## Layout

```
apps/
  shell/     end-user PWA — BFF, RBAC enforcement, CMS-driven slots
  cms/       authoring — content, roles, route bundles, wizard configs
  demo/      proving app: exercises all three mechanisms end to end
packages/
  rbac/                     permission catalog + resolution + guards
  auth/                     AuthProvider interface, mock, contract suite
  content-core/             ContentAdapter + TemplateKey + contract suite
  content-adapter-memory/   fixtures — dev, tests, Storybook
  content-adapter-supabase/ (Phase 5)
  config-schema/            ConfigBundle substrate: versioning, audit, contract suite
  i18n-core/                locale negotiation, routing, message provider (Phase 3)
  wizard/                   config-driven wizard + validator registry (Phase 7)
  config/                   shared eslint/prettier/tsconfig/vitest
supabase/    declarative schema, migrations, edge functions (Phase 4)
infra/       Terraform (Phase 4)
```

There is deliberately no `data-adapters` package. The domain-scoped adapters
the architecture sketches (`getSubmissions`, `getAnalyticsSummary`) belong to
a _product_ built on this platform, not to the platform — shipping an
interface here with no implementation and no consumer would be exactly the
speculative generalisation the design warns against. Apps add their own.

## Contract suites

Three packages export an executable contract that every implementation must
pass: `content-core`, `auth` and `config-schema`. They are separate build
entry points, never re-exported from the barrel, so `vitest` cannot reach an
application bundle.

The point is that matching method signatures is not substitutability.
TypeScript will happily accept an adapter that throws where another returns
`null`, or paginates by offset where another uses cursors — and every call
site then has to know which one it is talking to. The contracts pin the
behaviour that actually differs: error shape, pagination semantics, locale
fallback, and idempotency.

`pnpm test:contracts` runs them. A new adapter is finished when it passes.

## Getting started

Requires Node 22.13+ (see `.nvmrc`) and pnpm 11.

`@puranderdua8/tokens` and `@puranderdua8/theme` come from GitHub Packages,
so you need a personal access token with `read:packages`. It goes in your
user-level `~/.npmrc` — pnpm refuses to expand env vars in credentials read
from a committed project `.npmrc`, so this cannot live in the repo:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" <your-pat>
```

```bash
pnpm install
```

### CI and GitHub Packages

`GITHUB_TOKEN` in Actions is scoped to the repository it runs in, and
`@puranderdua8/tokens` and `@puranderdua8/theme` are published from
`web-components`. A fresh clone's CI therefore gets a 403 on install until
those two packages are told to trust this repo:

> Package page → **Package settings** → **Manage Actions access** → **Add
> repository** → this repo, with **Read**.

Do it for both packages. That is preferable to storing a personal access
token as a repository secret: nothing long-lived to rotate, and the workflow
needs no change.

```bash
pnpm dev
```

## Scripts

| Command               | Does                                                 |
| --------------------- | ---------------------------------------------------- |
| `pnpm build`          | Build every package and app                          |
| `pnpm dev`            | Run all apps in watch mode                           |
| `pnpm lint`           | ESLint across the workspace                          |
| `pnpm typecheck`      | `tsc --noEmit` across the workspace                  |
| `pnpm test`           | Unit tests                                           |
| `pnpm test:contracts` | Adapter contract suites — the substitutability proof |
| `pnpm format`         | Prettier write                                       |
