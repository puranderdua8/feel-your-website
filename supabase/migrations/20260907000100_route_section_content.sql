-- Per-instance route content.
--
-- Since the app-side change in PR #25 (`refactor!: route section instances own
-- per-locale content`), a `RouteSectionNode` carries its own `content`, keyed
-- by locale: the route owns the copy, not the section. A section placed twice
-- has two independent content bags and there is no shared `content_items`-style
-- store behind them.
--
-- Storage mirrors `route_section_instances`: flat, one row per
-- (instance, locale), written only through the SECURITY DEFINER RPC
-- (`insert_route_section_nodes`), read published via a view and as-drafts by a
-- route author. The `on delete cascade` from `route_section_instances` is what
-- lets `save_route_composition` keep replacing the whole tree wholesale —
-- deleting the instances takes their content with them.

create table public.route_section_content (
  bundle_id   uuid        not null references public.config_bundles (id) on delete cascade,
  instance_id uuid        not null references public.route_section_instances (id) on delete cascade,
  locale      text        not null,
  fields      jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (instance_id, locale)
);

comment on table public.route_section_content is
  'One row per (route section instance, locale). The route owns this copy; there is no fallback to another locale or to a shared section default. Folded onto RouteSectionNode.content by the adapter (assembleSectionTree), not by SQL.';

-- Every read path filters by bundle first (the published view groups by it;
-- the editor loads one bundle's tree), so the non-PK lookup is bundle_id.
create index route_section_content_by_bundle
  on public.route_section_content (bundle_id);

alter table public.route_section_content enable row level security;

-- Visibility follows the parent bundle, exactly like route_section_instances:
-- published rows are the manifest, drafts are for route authors only. Writes
-- go only through the SECURITY DEFINER RPC, so there is no write policy.
create policy route_section_content_read_published
  on public.route_section_content
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.route_bundles rb
      where rb.bundle_id = route_section_content.bundle_id and rb.published
    )
  );

create policy route_section_content_read_authors
  on public.route_section_content
  for select
  to authenticated
  using (public.has_permission('manage:routes'));

-- The published read model gains a `content` column: the instance's
-- `locale -> fields` map, aggregated from route_section_content. A new column
-- appended at the end, so `create or replace view` is allowed. `{}` for an
-- instance with no content rows yet — the adapter renders the section's
-- placeholder for that, same as the memory adapter.
create or replace view public.published_route_sections
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
  rsi.section_variant,
  coalesce(
    (
      select jsonb_object_agg(rsc.locale, rsc.fields)
      from public.route_section_content rsc
      where rsc.instance_id = rsi.id
    ),
    '{}'::jsonb
  ) as content
from public.config_bundles cb
join public.route_bundles rb on rb.bundle_id = cb.id
join public.route_section_instances rsi on rsi.bundle_id = cb.id
where cb.vocabulary = 'template_key'
  and rb.published;

grant select on public.published_route_sections to anon, authenticated;

-- insert_route_section_nodes now also writes each node's content rows, one per
-- locale in its `content` object. The rest is unchanged: `save_route_composition`
-- still deletes every route_section_instances row for the bundle and calls this
-- to rebuild, and the FK cascade above clears the old content with the instances.
create or replace function public.insert_route_section_nodes(
  p_bundle_id          uuid,
  p_parent_instance_id uuid,
  p_parent_slot        text,
  p_nodes              jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node       jsonb;
  v_ordinal    integer := 0;
  v_instance   uuid;
  v_slot_name  text;
  v_slot_nodes jsonb;
  v_locale     text;
  v_fields     jsonb;
begin
  if p_nodes is null or jsonb_typeof(p_nodes) <> 'array' then
    return;
  end if;

  for v_node in select value from jsonb_array_elements(p_nodes)
  loop
    v_instance := (v_node ->> 'instanceId')::uuid;

    insert into public.route_section_instances
      (id, bundle_id, parent_instance_id, parent_slot, ordinal, section_key, section_variant)
    values (
      v_instance,
      p_bundle_id,
      p_parent_instance_id,
      p_parent_slot,
      v_ordinal,
      v_node -> 'ref' ->> 'key',
      coalesce(v_node -> 'ref' ->> 'variant', '')
    );

    if jsonb_typeof(v_node -> 'content') = 'object' then
      for v_locale, v_fields in
        select key, value from jsonb_each(v_node -> 'content')
      loop
        insert into public.route_section_content (bundle_id, instance_id, locale, fields)
        values (p_bundle_id, v_instance, v_locale, v_fields);
      end loop;
    end if;

    if jsonb_typeof(v_node -> 'slots') = 'object' then
      for v_slot_name, v_slot_nodes in
        select key, value from jsonb_each(v_node -> 'slots')
      loop
        perform public.insert_route_section_nodes(
          p_bundle_id, v_instance, v_slot_name, v_slot_nodes
        );
      end loop;
    end if;

    v_ordinal := v_ordinal + 1;
  end loop;
end;
$$;

revoke execute on function
  public.insert_route_section_nodes(uuid, uuid, text, jsonb)
  from anon, authenticated, public;
