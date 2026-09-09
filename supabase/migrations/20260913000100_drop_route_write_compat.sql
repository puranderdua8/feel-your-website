-- Drop the deprecated route-write compatibility surface, now that nothing uses
-- it:
--
--   * the 8-arg `save_route_composition` wrapper — a bridge kept around
--     `20260911000100` so a hosted push need not be lock-stepped with the app
--     deploy. The deployed CMS calls the 10-arg form
--     (`SupabaseRouteCompositionWriter` sends `p_path_segment` / `p_parent_id`
--     / `p_params`), so the wrapper is dead.
--   * `route_section_instances.section_variant` — `20260910000100` dropped the
--     `SectionRef` wrapper and left this column "always empty, droppable
--     later". This is later.

-- 1. section_variant: rebuild the view that names it, then drop it ----------

-- `create or replace view` cannot remove a column, so drop + recreate.
drop view public.published_route_sections;

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
  coalesce(
    (
      select jsonb_object_agg(rsc.locale, rsc.fields)
      from public.route_section_content rsc
      where rsc.instance_id = rsi.id
    ),
    '{}'::jsonb
  ) as content,
  rb.parent_bundle_id,
  rb.param_meta
from public.config_bundles cb
join public.route_bundles rb on rb.bundle_id = cb.id
join public.route_section_instances rsi on rsi.bundle_id = cb.id
where cb.vocabulary = 'template_key'
  and rb.published;

grant select on public.published_route_sections to anon, authenticated;

alter table public.route_section_instances drop column section_variant;

-- 2. insert_route_section_nodes: stop writing the removed column ------------

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
      (id, bundle_id, parent_instance_id, parent_slot, ordinal, section_key)
    values (
      v_instance,
      p_bundle_id,
      p_parent_instance_id,
      p_parent_slot,
      v_ordinal,
      v_node ->> 'sectionKey'
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

-- 3. Drop the 8-arg save_route_composition wrapper -------------------------

drop function public.save_route_composition(
  uuid, text, text, boolean, integer, jsonb, text[], jsonb
);
