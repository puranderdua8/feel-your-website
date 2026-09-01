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
| Styling       | Tailwind v4 + `@feel-your-website/theme` (in-repo)                             |
| Components    | `@feel-your-website/ui` (in-repo)                                              |
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

| Guard                                      | Covers                                                                                | Status                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assertSeedMatchesCatalog()` in CI         | Code ↔ the committed seed file                                                        | Built — `packages/rbac/src/seed-drift.test.ts`                                                                                                                                                                                                                                                                            |
| Startup check                              | Seed file ↔ the **running database** — CI cannot see a deploy that skipped migrations | Not yet. `permissions_read` is `authenticated`-only RLS (Phase 4), so this needs the service-role key, which `apps/shell` does not otherwise use anywhere — see `content-adapter-supabase`'s and `auth-supabase`'s docs on why the anon key was enough for both. Deferred rather than adding that plumbing for one check. |
| Table grants limited to the migration role | Out-of-band edits via SQL or Supabase Studio                                          | Built — see `supabase/migrations`                                                                                                                                                                                                                                                                                         |

**Role CRUD carries none of this risk.** Roles are pure data with no mirror.
Only catalog changes — the rare, developer-initiated ones — need the seed
regenerated: `pnpm --filter @feel-your-website/rbac generate:seed`.

## Layout

```
apps/
  shell/     end-user PWA — BFF, RBAC enforcement, CMS-driven slots
  cms/       authoring — content, roles, route bundles, wizard configs
  demo/      proving app: exercises all three mechanisms end to end
packages/
  tokens/                   design tokens (primitive → semantic → extended)
  theme/                    theme resolution, CSS vars, ThemeProvider, Tailwind preset
  ui/                       the component library
  rbac/                     permission catalog + resolution + guards
  auth/                     AuthProvider interface, mock, contract suite
  auth-supabase/            AuthProvider backed by Supabase Auth
  content-core/             ContentAdapter + TemplateKey + contract suite
  content-adapter-memory/   fixtures — dev, tests, Storybook
  content-adapter-supabase/ ContentAdapter backed by Supabase Postgres
  config-schema/            ConfigBundle substrate: versioning, audit, contract suite
  i18n-core/                locale negotiation, routing, message provider
  wizard/                   config-driven wizard + validator registry (Phase 7)
  config/                   shared eslint/prettier/tsconfig/vitest
supabase/    schema, RLS policies, the auth hook, migrations, the generated permission seed
infra/       Terraform: Supabase project settings, Netlify site settings
```

### Why the design system lives here

`tokens`, `theme` and `ui` were originally a separate repo, published to a
private registry and consumed as versioned packages. They are vendored into
this workspace instead.

The split was solving a problem this project does not have. A boilerplate is
_cloned per project_, so there was exactly one consumer — and in exchange for
no benefit it cost a registry credential in CI, on Netlify, and in every
future clone, plus a publish-and-bump cycle for every change. Vendoring
removes all of it: there is no registry, no token, and a component fix is one
commit rather than a release.

If a client ever needs one design system shared across several repos,
extracting these three packages back out is the change to make _then_ — the
package boundaries are already drawn, so it stays a move rather than a
rewrite.

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

## Database

`supabase/migrations` is the Postgres half of `config-schema` and `rbac`:
the `config_bundles` substrate (roles and route bundles), the permission
mirror, the Custom Access Token auth hook, and public-read `content_items` /
`content_messages` / `published_route_manifest` for the content side.

A few things worth knowing before extending it:

- **Writes go through `SECURITY DEFINER` RPCs
  (`save_role_bundle`/`save_route_bundle`/`delete_config_bundle`), never
  direct table access.** Every table `INSERT`/`UPDATE`/`DELETE` grant is
  revoked from `anon`/`authenticated` — Postgres's default grants hand a new
  table to both, so this is revoked explicitly rather than left to RLS alone.
  A write is four things that must succeed or fail together (check the
  version, update the header, replace the items, append the audit row); the
  RPC is what makes that one round trip instead of four, and what makes the
  permission check (`has_permission('manage:roles')`, checked first, inside
  the function) impossible to route around.
- **Optimistic concurrency is enforced in SQL, not application code.** The
  version check is the predicate of the `UPDATE` itself
  (`write_bundle_header` in `..._config_bundle_writes.sql`), not a preceding
  `SELECT` — a check-then-write is exactly the race this exists to close. A
  mismatch raises with `errcode = 'PT409'`, which PostgREST turns into an
  HTTP 409 for `ConfigConflictError` to map.
- **RLS is split by audience, and it is easy to get this wrong in the
  direction that fails silently.** `published_route_manifest` is declared
  `security_invoker = true` (avoiding the RLS-bypass footgun a definer view
  would be), which means it only returns rows the _querying role_ — not the
  view's owner — can see on the underlying tables. That requires
  `config_bundles`/`route_bundles`/`route_templates` to carry their own read
  policies for anonymous visitors, or the view silently returns nothing to a
  real site visitor while looking correct in every test run as the owning
  role. See `..._bundle_read_policies.sql` for the actual split: published
  route data is public, role/permission data never is, and audit history
  needs `view:audit` specifically rather than reusing `manage:roles`.
- **The delete path re-stamps staleness explicitly, ahead of the cascade.**
  Deleting a role bundle cascades into `role_permissions` and `user_roles`,
  and nothing orders that cascade relative to the trigger that marks holders'
  tokens stale — so `delete_config_bundle` finds the holders and calls
  `touch_permission_state` itself, before the delete, rather than trusting a
  trigger to still have something to find.

Everything above was exercised against a real local Postgres (`supabase db
reset`, and `psql` sessions simulating both an unauthorized caller and an
authorized one) while building it, not just read back from the SQL — CI does
the same replay on every PR (see the `supabase` job in `ci.yml`).

## The Supabase adapters

`content-adapter-supabase` and `auth-supabase` are the first real
implementations of `ContentAdapter` and `AuthProvider` — set
`CONTENT_ADAPTER=supabase` / `AUTH_PROVIDER=supabase` (see `.env.example`) to
use them. Both pass the exact same contract suites the mock/memory adapters
do, run against a real local Supabase rather than mocked — `supabase start`,
then each package's `pnpm test:contracts` — because a contract this code only
compiled against, never actually sent over the wire, would have missed real
things: the RLS gap in the Database section above, or a fixture that collides
with `supabase/seed/dev-content.sql`'s row of the same key (both actually
happened while building this).

- **`content-adapter-supabase` reads with the `anon` key only.** Every table
  it touches is public-read RLS (see Database, above), so there is no session
  to carry and no service-role key anywhere in `apps/shell`. Locale fallback
  (`getContent`'s `translated: false` case) happens in this adapter's own
  TypeScript, not SQL — one query for `[requested, default]`, then prefer the
  requested row per template key — because the content volume this platform
  serves is pages and templates, not a firehose large enough to earn a
  bespoke SQL function for a rule already expressed correctly in five lines.
- **`auth-supabase` reads every claim through `getClaims()`, never
  `getSession()`'s own `session.user`.** `@supabase/ssr`'s own docs call that
  object untrustworthy when the storage medium is cookies — exactly this
  case — so `app_permissions` is always freshly verified against the Auth
  server's signing key, not merely carried along from whenever the cookie was
  written.
- **Session persistence is dependency-injected, not framework-specific.**
  `auth-supabase` exports a `CookieAdapter` interface (`getAll`/`setAll`) —
  the same shape `@supabase/ssr` itself wants — rather than depending on
  TanStack Start directly. `apps/shell/src/server/adapters.ts` supplies one
  backed by the real request; the contract suite supplies
  `MemoryCookieAdapter`, a `Map`, so `createProvider()` gets what the contract
  requires: a fresh, genuinely isolated session per test.
- **The TanStack cookie glue lives inside `adapters.ts` itself, not its own
  file.** `seam.test.ts` enforces that exactly one module may import a
  concrete backend package; the glue has to name `auth-supabase` for the
  `CookieAdapter` type it implements, so it stays inside the one file allowed
  to.
- **The seed vs. contract-fixture split in `dev-content.sql`.** That file
  seeds `content_messages` (genuinely rendered — the home page's bootstrap
  copy) but not `content_items`: nothing in `apps/shell` reads `content_items`
  yet, and the one time this file tried to seed it under the same key names
  `CONTRACT_FIXTURE` uses (`guidance`, `legal`), it collided with the contract
  suite's own `beforeAll`. Real app data and a package's test fixtures
  drawing from the same namespace was the bug; the fix was giving the fixture
  clearly test-scoped names, not carving out an exception for the seed.

## Infrastructure

`infra/` is Terraform for what used to be a dashboard checkbox with no
record of who set it or when: registering the Custom Access Token hook on
the Supabase project, and the Netlify build settings and environment
variables. See [`infra/README.md`](infra/README.md) — in particular, what it
deliberately does not manage (creating the Supabase organization or the
Netlify team, linking the git repository) and why nothing in it has been
applied yet.

## Getting started

Requires Node 22.23.2+ (see `.nvmrc`) and pnpm 11.

```bash
pnpm install
```

No credentials are needed — not locally, not in CI, not on Netlify. Every
dependency resolves from public npm or from this workspace.

The app itself runs against `MemoryContentAdapter`/`MockAuthProvider` with no
further setup (`pnpm --filter @feel-your-website/shell dev`). To run it
against a real Supabase instead: `supabase start` (needs Docker), then set
`CONTENT_ADAPTER=supabase` / `AUTH_PROVIDER=supabase` and the three
`SUPABASE_*` variables in `apps/shell/.env` — see `.env.example` for what
each one is and where it's safe to expose.

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
