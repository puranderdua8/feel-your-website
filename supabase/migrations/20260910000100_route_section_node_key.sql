-- The route section node is `{ instanceId, sectionKey, content, slots }`.
--
-- `RouteSectionNode` dropped its `ref: { key, variant }` wrapper — content
-- never keyed by variant, so `SectionRef` was a one-field type wearing a
-- two-field shape. `insert_route_section_nodes` parsed `ref.key` / `ref.variant`
-- out of the tree jsonb; it now reads `sectionKey` directly and writes
-- `section_variant = ''` (the column stays, always empty, droppable later).

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
      v_node ->> 'sectionKey',
      ''
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
