-- Writing a nested route section tree.
--
-- `20260903000100_route_composition.sql` added the storage and taught the
-- flat `save_route_bundle` to mirror its item list into root instances. This
-- adds the RPC that writes a genuinely nested tree — slot fills, per-route
-- overrides — in one transaction, behind the same optimistic-concurrency and
-- audit machinery `save_route_bundle` uses (`write_bundle_header`,
-- `raise_bundle_conflict`).
--
-- The tree arrives as jsonb: an array of
--   { instanceId: uuid, ref: { key, variant }, slots: { <slotName>: [ ...nodes ] } }
-- objects. The client mints each `instanceId` (a uuid) and it is inserted as
-- the row's `id` directly, so the whole tree goes in one pre-order pass with
-- no generated ids to round-trip. `route_templates` and the flattened `items`
-- audit list are refreshed from `p_items` (which the caller computes as the
-- pre-order flatten) so the two models stay consistent while both exist —
-- B5 drops `route_templates` and this bookkeeping with it.

-- Recursively inserts one level of the tree, then its slots. SECURITY DEFINER
-- and EXECUTE revoked: it writes `route_section_instances` directly, so it
-- must only be reachable from `save_route_composition`, which gates on
-- `manage:routes` first.
create function public.insert_route_section_nodes(
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

create function public.save_route_composition(
  p_id               uuid,
  p_name             text,
  p_path             text,
  p_published        boolean,
  p_expected_version integer,
  p_tree             jsonb,
  p_items            text[]
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

  -- Header, version check, audit row — identical to save_route_bundle. A
  -- version mismatch raises PT409, an unknown id PT404.
  v_bundle := public.write_bundle_header(
    p_id, 'template_key', p_name, p_items, p_expected_version, auth.uid()
  );

  -- The audit row write_bundle_header just wrote gets the real tree too.
  update public.config_bundle_versions
     set snapshot = p_tree
   where bundle_id = v_bundle.id and version = v_bundle.version;

  insert into public.route_bundles (bundle_id, path, published)
  values (v_bundle.id, p_path, p_published)
  on conflict (bundle_id) do update
    set path = excluded.path, published = excluded.published;

  -- Keep the flat mirror in step: SupabaseConfigBundleStore and
  -- published_route_manifest still read route_templates until B5.
  delete from public.route_templates where bundle_id = v_bundle.id;
  insert into public.route_templates (bundle_id, ordinal, template_key)
  select v_bundle.id, ordinality - 1, item
  from unnest(p_items) with ordinality as t(item, ordinality);

  -- Replace the whole tree. The self-FK cascade would let a delete of the
  -- roots clear everything, but deleting every row for the bundle is simpler
  -- and order-independent.
  delete from public.route_section_instances where bundle_id = v_bundle.id;
  perform public.insert_route_section_nodes(v_bundle.id, null, null, p_tree);

  return v_bundle;
end;
$$;
