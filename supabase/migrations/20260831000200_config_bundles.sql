-- The config-bundle substrate.
--
-- The Postgres half of `@feel-your-website/config-schema`: a named, versioned,
-- audited bundle of items drawn from a fixed, code-defined vocabulary. Roles
-- (items = permissions) and route bundles (items = template keys) are the two
-- instances.
--
-- The header is shared; the item tables are not, and that asymmetry is the
-- point — see the note on `route_templates` below.

create table public.config_bundles (
  id         uuid primary key default gen_random_uuid(),
  vocabulary text        not null check (vocabulary in ('permission', 'template_key')),
  name       text        not null check (length(btrim(name)) > 0),

  -- Monotonic, and doubling as the optimistic-concurrency token: a writer
  -- states the version it read and a mismatch means someone else got there
  -- first. Two editors in a CMS is the normal case, not an edge case.
  version    integer     not null default 1 check (version > 0),

  updated_at timestamptz not null default now(),
  updated_by uuid        not null,

  -- Scoped to the vocabulary rather than global: a role called "help" and a
  -- route bundle called "help" are unrelated things.
  unique (vocabulary, name)
);

-- Route bundles carry one field roles do not. Rather than a nullable column on
-- the shared header guarded by a check constraint, it lives in a satellite —
-- so `config_bundles` stays genuinely vocabulary-agnostic and a third
-- vocabulary later adds a table instead of another nullable column.
create table public.route_bundles (
  bundle_id uuid primary key references public.config_bundles (id) on delete cascade,
  path      text    not null unique check (path like '/%'),

  -- Drafts never reach the shell; `getRouteManifest` filters on this.
  published boolean not null default false
);

-- Role items. The foreign key into `permissions` is the entire reason the
-- catalog is mirrored into Postgres at all: it makes a role referencing a
-- permission the code has dropped impossible rather than merely unlikely.
--
-- `on delete restrict` is deliberate. When the generated seed removes a
-- permission that a role still grants, this raises and the seed fails. That is
-- the correct outcome: someone has to decide what happens to that role, and
-- silently changing who can do what is exactly what must not happen quietly.
create table public.role_permissions (
  bundle_id  uuid not null references public.config_bundles (id) on delete cascade,
  permission text not null references public.permissions (name) on delete restrict,
  primary key (bundle_id, permission)
);

-- Route items. Deliberately *not* foreign-keyed to a template-key mirror, and
-- the asymmetry with `role_permissions` is a decision rather than an omission.
--
-- A stale permission grant is a security defect: it must be impossible, so
-- Postgres enforces it. A stale template key is a render error, and the CMS
-- already rejects unknown keys at publish time
-- (`findUnknownTemplateKeys`) — synchronously, while the author is looking at
-- it. Mirroring the template catalog too would buy a second generator, a
-- second drift guard and a second seed file to re-enforce a rule that is
-- already enforced earlier and more helpfully.
create table public.route_templates (
  bundle_id    uuid    not null references public.config_bundles (id) on delete cascade,
  -- Render order is data, not an accident of row order. Named `ordinal`
  -- rather than `position`, which Postgres treats as a function keyword.
  ordinal      integer not null check (ordinal >= 0),
  template_key text    not null,
  primary key (bundle_id, ordinal)
);

-- Point-in-time snapshot, written on every change.
--
-- Deliberately free of foreign keys, including to `config_bundles`. History
-- has to outlive what it describes: the version that recorded a deletion is
-- the most useful row in the table, and a cascade would take it with the
-- bundle. Items are a plain array for the same reason — the audit trail must
-- still read correctly after a permission leaves the catalog.
create table public.config_bundle_versions (
  bundle_id  uuid        not null,
  version    integer     not null,
  vocabulary text        not null,
  name       text        not null,
  items      text[]      not null,
  updated_at timestamptz not null,
  updated_by uuid        not null,
  action     text        not null check (action in ('created', 'updated', 'deleted')),
  primary key (bundle_id, version)
);

create index config_bundle_versions_by_time
  on public.config_bundle_versions (bundle_id, version desc);

alter table public.config_bundles         enable row level security;
alter table public.route_bundles          enable row level security;
alter table public.role_permissions       enable row level security;
alter table public.route_templates        enable row level security;
alter table public.config_bundle_versions enable row level security;
