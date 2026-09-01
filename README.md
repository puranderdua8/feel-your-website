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
  cms/       authoring — content, roles, route bundles (wizard configs: Phase 7)
  demo/      proving app: exercises all three mechanisms end to end
packages/
  tokens/                   design tokens (primitive → semantic → extended)
  theme/                    theme resolution, CSS vars, ThemeProvider, Tailwind preset
  ui/                       the component library
  rbac/                     permission catalog + resolution + guards
  auth/                     AuthProvider interface, mock, contract suite
  auth-supabase/            AuthProvider backed by Supabase Auth
  content-core/             ContentAdapter + ContentWriter + TemplateKey + contract suite
  content-adapter-memory/   fixtures — dev, tests, Storybook
  content-adapter-supabase/ ContentAdapter + ContentWriter backed by Supabase Postgres
  config-schema/            ConfigBundle substrate: versioning, audit, contract suite
  config-bundle-supabase/   ConfigBundleStore backed by Supabase Postgres
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

`pnpm test:contracts` runs them. A new adapter is finished when it passes —
with one exception, and it's worth knowing which: `config-bundle-supabase`
does **not** run `config-schema`'s shared contract. See
"The config-bundle and content-write adapters" below for why a
session-authenticated backend cannot honour that contract's `actor` parameter
the way `MemoryConfigBundleStore` does, and what it runs instead.

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
- **Content writes are a plain upsert, not the bundle apparatus.**
  `save_content_item` / `delete_content_item` / `save_content_message` /
  `delete_content_message` (`..._content_writes.sql`) exist for the same
  `has_permission('manage:content')`-checked-first, `SECURITY DEFINER` reason
  as the bundle RPCs, but carry no optimistic-concurrency check: content is a
  field-bag per `(template key, locale)` or `(locale, key)`, not a versioned,
  audited bundle drawn from a fixed vocabulary, so there is no version to
  conflict on. See `ContentWriter` in `content-core` for the write-side
  interface this backs — deliberately separate from the read-only
  `ContentAdapter` (see that interface's own doc for why).

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

## The config-bundle and content-write adapters

`config-bundle-supabase` (`SupabaseConfigBundleStore`) and the write half of
`content-adapter-supabase` (`SupabaseContentWriter`) are `apps/cms`'s
backends: one store per vocabulary — `"permission"` for the role editor,
`"template_key"` for the route bundle editor — and one writer for content
items and messages. Unlike the read-only adapters above, every method here
runs as the _signed-in caller_, not the anon key: the RPCs check
`has_permission()` against that session's own JWT claims, so these classes
build their client with `@supabase/ssr`'s `createServerClient` and a
`CookieAdapter`, the same shape `auth-supabase` already exports (declared
again in each package rather than imported from it — see each package's own
`CookieAdapter.ts` for why a structural type stays cheaper to duplicate three
times than to introduce a cross-adapter dependency for).

- **`SupabaseConfigBundleStore` does not run `config-schema`'s shared
  `runConfigBundleStoreContract`, and that is a real finding, not a gap.**
  The contract asserts that a caller-supplied `actor` string round-trips
  verbatim into `updatedBy` — true for `MemoryConfigBundleStore`, which
  trusts whatever it is given, and false for any backend where `updated_by`
  is `auth.uid()` of the authenticated session (`save_role_bundle` /
  `save_route_bundle` never even accept an actor parameter — see
  `..._config_bundle_writes.sql`). A client claiming to be someone else is
  exactly what session-derived authorship exists to prevent, so this is not a
  bug to fix — it is two genuinely different notions of "actor" that the
  shared contract cannot describe at once. `config-bundle-supabase/src/live.test.ts`
  exercises the same behaviours (versioning, conflict detection, vocabulary
  validation, deletion, audit history) by hand instead, asserting against the
  real signed-in user's id.
- **Route bundles need `path` and `published`, which `config_bundles` itself
  does not have** — they live in a separate `route_bundles` satellite table
  (see Database, above). Rather than a second, route-only type alongside
  `ConfigBundleStore`, `config-schema`'s `ConfigBundle` / `CreateBundleInput` /
  `UpdateBundleInput` simply carry them as optional fields, unset by every
  vocabulary that has no use for them (roles).
- **`route_bundles.path` carries a real, global `unique` constraint that the
  store's own test-isolation namespace does nothing to protect**, and found
  the hard way: `live.test.ts` originally reused the literal path `/draft`
  across two tests, and the second one failed with a bare "backend
  unreachable" — `mapConfigError`'s catch-all fallback, because Postgres's
  `23505` (unique violation) wasn't one of the codes it switched on yet. Fixed
  in two places: distinct paths per test, and a real `23505` branch in
  `mapConfigError` reporting _that_, not a manufactured outage.
- **Node's `BroadcastChannel` and multiple signed-in `GoTrueClient` instances
  do not mix, and it is not merely the library's own "multiple clients"
  warning.** Every live suite that signs in more than a couple of sessions in
  one process (this file, and `content-adapter-supabase`'s
  `writer.live.test.ts`, which holds two _different_ real sessions — an
  editor and a permission-less outsider — alive at once to prove the database
  itself refuses the write) crashed with `TypeError: The "event" argument
must be an instance of Event. Received an instance of MessageEvent`, from
  Node's own `BroadcastChannel` — auth-js's `isBrowser()` check finds the
  `window` the workspace's default jsdom Vitest environment provides and
  opens a real cross-tab sync channel it would never touch under plain Node.
  Every affected file now pins `// @vitest-environment node` at the top, and
  `SupabaseContentWriter` additionally takes an optional `storageKey` so two
  concurrently-live sessions in one test don't share a channel name even
  incidentally. Discovered by running the suites, not by reading the
  library's source — every one of the 22 real assertions in
  `writer.live.test.ts` still passed while the process crashed underneath
  them, which is what made it easy to miss.

## The CMS app

`apps/cms` mirrors `apps/shell`'s seam (`src/server/adapters.ts` is the only
module allowed to name a concrete backend; `seam.test.ts` checks it the same
way) but is deliberately smaller in a few specific ways:

- **One route, three tabs, not three routes.** Nobody bookmarks "the roles
  tab" — the only thing gating access is the signed-in session's permissions,
  loaded once by `/`'s own loader. `Can` (from `@feel-your-website/rbac/react`)
  gates each tab's content exactly as `apps/shell`'s `admin.tsx` does: hiding
  a tab is a display decision, and every server function behind it is refused
  independently by the database.
- **No `i18n-core` dependency, and its own English chrome hardcoded.** This is
  an internal authoring tool with one real audience — whoever holds a CMS
  permission — not a localized end-user surface, and its own UI cannot
  sensibly be driven by the CMS it is itself the authoring tool for without a
  chicken-and-egg dependency on content that might not exist yet.
- **The role and route-bundle stores follow `AUTH_PROVIDER`, not a config-bundle-specific
  env var.** A config-bundle write is only ever meaningful against a _real_
  signed-in session — `has_permission()` reads that session's own JWT claims
  — so `AUTH_PROVIDER=mock` gets `MemoryConfigBundleStore` (which cannot check
  a real permission anyway) and `AUTH_PROVIDER=supabase` gets
  `SupabaseConfigBundleStore` sharing that same session's cookies. A separate
  `CONFIG_BUNDLE_STORE` variable would only ever need to agree with
  `AUTH_PROVIDER`, which is a variable that can disagree with itself, not a
  useful axis of configuration.
- **The route bundle editor's template catalog
  (`src/content/template-keys.ts`) is a placeholder.** This boilerplate ships
  no real templates or a renderer for them yet — nothing in `apps/shell` calls
  `loadContent` from a route — so the two example keys stand in for whatever a
  real project's UI kit actually exports. A real project replaces the list;
  nothing that imports it needs to change.
- **It is its own Netlify site, not the same one as `apps/shell`.** `apps/cms`
  has its own `netlify.toml` (`base = "/"`, matching the root file's — this is
  still one pnpm workspace with one lockfile at the repo root, so `base`
  points at where the lockfile and this file live, not at `apps/cms/`) and its
  own `netlify()` Vite plugin. A site pointed at this repo has to be told
  which config file is its: `apps/shell`'s picks up the repo-root
  `netlify.toml` by default, so `apps/cms`'s site needs "Netlify configuration
  file" set explicitly, in that site's own dashboard, to
  `apps/cms/netlify.toml` — otherwise it silently builds and publishes the
  shell instead. **Set `AUTH_PROVIDER=supabase` on that site before anyone can
  reach it publicly.** Left at the default `mock`, `MockAuthProvider`'s one
  hardcoded account (`editor@example.com` / `demo`, in
  `apps/cms/src/server/adapters.ts`) holds every permission this platform
  defines — fine for a local dev server nobody else can reach, a real backdoor
  on a public URL.

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

Both apps run against `MemoryContentAdapter`/`MockAuthProvider` with no
further setup — `pnpm --filter @feel-your-website/shell dev` (port 3000) or
`pnpm --filter @feel-your-website/cms dev` (port 3001; sign in with one of
`MockAuthProvider`'s accounts, see `apps/cms/src/server/adapters.ts`). To run
either against a real Supabase instead: `supabase start` (needs Docker), then
set `CONTENT_ADAPTER=supabase` / `AUTH_PROVIDER=supabase` and the three
`SUPABASE_*` variables in that app's own `.env` — see `.env.example` for what
each one is and where it's safe to expose. `apps/cms` needs a real user
granted a real permission to do anything useful against Supabase: seed one
the same way `config-bundle-supabase/src/live.test.ts` does (`admin.auth.admin.createUser`,
a `config_bundles` row of `role_permissions`, a `user_roles` assignment).

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
