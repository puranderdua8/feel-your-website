-- Drop the flat route model.
--
-- Since B3/B4, `route_section_instances` + `published_route_sections` +
-- `save_route_composition` are the source of truth for a route's composition,
-- and the CMS route editor writes only through them. `route_templates`, the
-- flat `save_route_bundle` wrapper and the `published_route_manifest` view
-- have been kept alive only as a compatibility shim for
-- `SupabaseConfigBundleStore`'s route branch — which this migration's app-side
-- companion also removes. Nothing reads them any more.

-- 1. save_route_composition stops mirroring into route_templates. The audit
--    `items` array still comes from `p_items` (the caller's pre-order flatten)
--    via write_bundle_header — that is unchanged.
create or replace function public.save_route_composition(
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

  v_bundle := public.write_bundle_header(
    p_id, 'template_key', p_name, p_items, p_expected_version, auth.uid()
  );

  update public.config_bundle_versions
     set snapshot = p_tree
   where bundle_id = v_bundle.id and version = v_bundle.version;

  insert into public.route_bundles (bundle_id, path, published)
  values (v_bundle.id, p_path, p_published)
  on conflict (bundle_id) do update
    set path = excluded.path, published = excluded.published;

  delete from public.route_section_instances where bundle_id = v_bundle.id;
  perform public.insert_route_section_nodes(v_bundle.id, null, null, p_tree);

  return v_bundle;
end;
$$;

-- 2. delete_config_bundle's route branch read route_templates to build the
--    audit `items` array; read the root section instances instead.
create or replace function public.delete_config_bundle(
  p_id               uuid,
  p_expected_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.config_bundles;
  v_items  text[];
begin
  select * into v_bundle from public.config_bundles where id = p_id;
  if not found then
    raise exception 'No config bundle %', p_id using errcode = 'PT404';
  end if;

  if v_bundle.vocabulary = 'permission' then
    if not public.has_permission('manage:roles') then
      raise exception 'manage:roles is required to delete a role'
        using errcode = '42501';
    end if;
    select coalesce(array_agg(permission order by permission), '{}')
      into v_items
      from public.role_permissions where bundle_id = p_id;
  else
    if not public.has_permission('manage:routes') then
      raise exception 'manage:routes is required to delete a route bundle'
        using errcode = '42501';
    end if;
    select coalesce(array_agg(section_key order by ordinal), '{}')
      into v_items
      from public.route_section_instances
      where bundle_id = p_id and parent_instance_id is null;
  end if;

  if v_bundle.version <> p_expected_version then
    perform public.raise_bundle_conflict(p_expected_version, v_bundle.version);
  end if;

  perform public.touch_permission_state(
    array(select user_id from public.user_roles where bundle_id = p_id)
  );

  insert into public.config_bundle_versions
    (bundle_id, version, vocabulary, name, items, updated_at, updated_by, action)
  values
    (v_bundle.id, v_bundle.version + 1, v_bundle.vocabulary, v_bundle.name,
     v_items, now(), auth.uid(), 'deleted');

  delete from public.config_bundles where id = p_id;
end;
$$;

-- 3. Drop the flat read model and the flat writer, then the table itself
--    (its RLS policies go with it).
drop view if exists public.published_route_manifest;

drop function if exists
  public.save_route_bundle(text, text, text[], boolean, uuid, integer);

drop table if exists public.route_templates;
