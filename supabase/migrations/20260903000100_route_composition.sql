-- Route composition: a route renders a recursive tree of section instances.
--
-- `route_templates` (see ..._config_bundles.sql) modelled a route as a flat
-- ordered list of template keys. A section can now carry *slots* that other
-- sections fill (an icon inside a card, buttons inside that card's body), and
-- a route composes a tree of these — with per-route overrides: the same card
-- section can hold a different icon on one page than on another.
--
-- The tree is stored flat, one row per instance, its parent named by id +
-- slot. It is assembled into a tree in TypeScript (`assembleSectionTree` in
-- @feel-your-website/content-core), never a recursive SQL CTE — one shared
-- helper both the memory and Supabase adapters call, so the two cannot
-- diverge on tree-building.
--
-- This migration adds the table, its published read model, and makes the
-- existing flat `save_route_bundle` *also* write root-level instances, so
-- `published_route_sections` is populated for routes authored the flat way
-- from day one. The RPC that writes a genuinely nested tree
-- (`save_route_composition`) and the CMS editor that calls it come in the
-- following phases; `route_templates` stays until the B5 cleanup so
-- `SupabaseConfigBundleStore` is untouched here.

create table public.route_section_instances (
  id                 uuid primary key default gen_random_uuid(),
  bundle_id          uuid    not null references public.config_bundles (id) on delete cascade,

  -- Self-reference: a slot child points at its parent instance. `on delete
  -- cascade` means deleting an instance takes its whole subtree with it —
  -- which is also why a `save_*` function can delete every row for a bundle
  -- and reinsert, rather than diffing.
  parent_instance_id uuid    references public.route_section_instances (id) on delete cascade,

  -- Which slot of the parent this instance fills. Null iff it is a root.
  parent_slot        text,

  -- Order within (bundle_id, parent_instance_id, parent_slot).
  ordinal            integer not null check (ordinal >= 0),

  section_key        text    not null,
  section_variant    text    not null default '',

  -- A root has neither a parent nor a slot; a slot child has both.
  check ((parent_instance_id is null) = (parent_slot is null)),

  -- No two siblings in the same slot — nor two roots of one bundle — share an
  -- order. `nulls not distinct` so the root group, where parent_instance_id
  -- and parent_slot are both null, is covered too and not just filled slots.
  unique nulls not distinct (bundle_id, parent_instance_id, parent_slot, ordinal)
);

comment on table public.route_section_instances is
  'Flat storage for a route bundle''s section tree; assembled into a tree by the adapter (assembleSectionTree), not by SQL. Deliberately not FK''d to content_items(section_key, section_variant): a stale ref is a CMS-time validation error (findUnknownSectionRefs), not a DB integrity error to enforce twice — the same reasoning as route_templates.template_key.';

create index route_section_instances_by_parent
  on public.route_section_instances (bundle_id, parent_instance_id, parent_slot, ordinal);

alter table public.route_section_instances enable row level security;

-- Visibility follows the parent bundle, exactly like route_templates:
-- published rows are the manifest, drafts are for route authors only. Writes
-- go only through the SECURITY DEFINER RPCs, so there is no write policy for
-- anon/authenticated — again matching route_templates.
create policy route_section_instances_read_published
  on public.route_section_instances
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.route_bundles rb
      where rb.bundle_id = route_section_instances.bundle_id and rb.published
    )
  );

create policy route_section_instances_read_authors
  on public.route_section_instances
  for select
  to authenticated
  using (public.has_permission('manage:routes'));

-- The published read model for ContentAdapter.getRouteManifest(). Flat rows,
-- one per instance; the adapter groups by bundle and assembles the tree.
-- `security_invoker` so it carries no privilege of its own — the same
-- RLS-bypass footgun avoidance as published_route_manifest.
create view public.published_route_sections
  with (security_invoker = true)
as
select
  cb.id                  as bundle_id,
  rb.path,
  cb.version,
  cb.updated_at,
  rsi.id                 as instance_id,
  rsi.parent_instance_id,
  rsi.parent_slot,
  rsi.ordinal,
  rsi.section_key,
  rsi.section_variant
from public.config_bundles cb
join public.route_bundles rb on rb.bundle_id = cb.id
join public.route_section_instances rsi on rsi.bundle_id = cb.id
where cb.vocabulary = 'template_key'
  and rb.published;

comment on view public.published_route_sections is
  'Read model for ContentAdapter.getRouteManifest(). One row per section instance of a published route; draft bundles never appear. A published route with an empty tree contributes no rows.';

grant select on public.published_route_sections to anon, authenticated;

-- The audit trail can now carry the tree as authored, not just the flattened
-- key list. Nullable: role-vocabulary rows never set it, nor does history
-- written before composition existed.
alter table public.config_bundle_versions
  add column snapshot jsonb;

comment on column public.config_bundle_versions.snapshot is
  'The route section tree as authored, for the template_key vocabulary. Null for role bundles and for pre-composition history.';

-- Backfill: every existing flat route item becomes a root instance. A fresh
-- `supabase db reset` runs this before the seed step, so route_templates is
-- empty here and this is a no-op — it matters only for databases that already
-- hold route data.
insert into public.route_section_instances
  (bundle_id, parent_instance_id, parent_slot, ordinal, section_key, section_variant)
select rt.bundle_id, null, null, rt.ordinal, rt.template_key, ''
from public.route_templates rt;

-- save_route_bundle keeps writing route_templates (SupabaseConfigBundleStore
-- still reads it) and now ALSO mirrors the flat list into root instances, so
-- published_route_sections is correct for routes authored the flat way. A
-- nested tree needs save_route_composition (next phase); this wrapper only
-- ever writes roots with no slots.
create or replace function public.save_route_bundle(
  p_name             text,
  p_path             text,
  p_items            text[],
  p_published        boolean default false,
  p_id               uuid    default null,
  p_expected_version integer default null
)
returns public.config_bundles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.config_bundles;
begin
  if not public.has_permission('manage:routes') then
    raise exception 'manage:routes is required to write a route bundle'
      using errcode = '42501';
  end if;

  v_bundle := public.write_bundle_header(
    p_id, 'template_key', p_name, p_items, p_expected_version, auth.uid()
  );

  insert into public.route_bundles (bundle_id, path, published)
  values (v_bundle.id, p_path, p_published)
  on conflict (bundle_id) do update
    set path = excluded.path, published = excluded.published;

  delete from public.route_templates where bundle_id = v_bundle.id;

  insert into public.route_templates (bundle_id, ordinal, template_key)
  select v_bundle.id, ordinality - 1, item
  from unnest(p_items) with ordinality as t(item, ordinality);

  delete from public.route_section_instances where bundle_id = v_bundle.id;

  insert into public.route_section_instances
    (bundle_id, parent_instance_id, parent_slot, ordinal, section_key, section_variant)
  select v_bundle.id, null, null, ordinality - 1, item, ''
  from unnest(p_items) with ordinality as t(item, ordinality);

  return v_bundle;
end;
$$;
