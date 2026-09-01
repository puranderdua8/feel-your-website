-- CMS content and UI-chrome messages.
--
-- Deliberately outside the `config_bundles` substrate. That substrate exists
-- for a fixed, code-defined vocabulary edited as a whole named set — a role's
-- permission list, a route's template list. Content is not that: the contract
-- in `@feel-your-website/content-core` has no write surface at all, no
-- version field on `Content`, and `getContent`'s locale fallback is adapter
-- behaviour, not audited state. Giving it the bundle apparatus would be
-- solving a versioning problem this vocabulary does not have. Authoring
-- (Phase 6, `apps/cms`) can add drafting on top of this without touching
-- config_bundles.
--
-- Content is public read, matching the contract: `ContentAdapterError`'s
-- `forbidden` code exists for a future permission-gated template, but nothing
-- in the current contract exercises it, so nothing here does either. Writes
-- are revoked from every client role for the same reason `permissions` is:
-- Postgres's default grants hand every new table to anon/authenticated, and
-- Phase 6 must add a real gated write path rather than merely widen RLS.

create table public.content_items (
  template_key text        not null,
  locale       text        not null,
  fields       jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (template_key, locale)
);

comment on table public.content_items is
  'One row per (template key, locale). Locale fallback and translated:false are resolved by the adapter, not stored here.';

create table public.content_messages (
  locale     text not null,
  -- Flat dotted key, e.g. `bootstrap.retry` — matches getMessages()'s shape
  -- directly; @feel-your-website/i18n-core unflattens it at the app boundary,
  -- not here.
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (locale, key)
);

alter table public.content_items    enable row level security;
alter table public.content_messages enable row level security;

create policy content_items_read
  on public.content_items for select to anon, authenticated using (true);

create policy content_messages_read
  on public.content_messages for select to anon, authenticated using (true);

revoke insert, update, delete on public.content_items    from anon, authenticated;
revoke insert, update, delete on public.content_messages from anon, authenticated;

-- The published route manifest, joined and ordered once here rather than in
-- every adapter that needs it. `getRouteManifest` must never see a draft, so
-- the `published` filter lives in the view itself and cannot be forgotten at
-- a call site.
create view public.published_route_manifest
  with (security_invoker = true)
as
select
  cb.id         as bundle_id,
  cb.name,
  cb.version,
  cb.updated_at,
  rb.path,
  coalesce(
    array_agg(rt.template_key order by rt.ordinal) filter (where rt.template_key is not null),
    '{}'
  ) as items
from public.config_bundles cb
join public.route_bundles rb on rb.bundle_id = cb.id
left join public.route_templates rt on rt.bundle_id = cb.id
where cb.vocabulary = 'template_key'
  and rb.published
group by cb.id, cb.name, cb.version, cb.updated_at, rb.path;

comment on view public.published_route_manifest is
  'Read model for ContentAdapter.getRouteManifest(). Draft bundles (route_bundles.published = false) never appear here.';

-- `security_invoker` means the view carries no privilege of its own — the
-- querying role's grants and RLS apply exactly as if it queried the four
-- tables directly. Readable by the same roles as `route_bundles`.
grant select on public.published_route_manifest to anon, authenticated;
