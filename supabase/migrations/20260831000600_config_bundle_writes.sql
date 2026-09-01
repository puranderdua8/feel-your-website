-- Writing bundles.
--
-- Every bundle write goes through these functions rather than through
-- PostgREST table access, because one edit is four statements that have to
-- succeed or fail together: check the version, update the header, replace the
-- items, append the audit row. Split across round trips, a client that dies
-- halfway leaves a bundle whose version says it changed and whose items say it
-- did not.
--
-- Putting it here also means the optimistic-concurrency guarantee is a
-- property of the database, so every adapter gets exactly the same one instead
-- of each re-implementing it and one of them getting it subtly wrong.
--
-- SECURITY DEFINER with an explicit permission check at the top, rather than
-- INVOKER: `config_bundle_versions` deliberately grants insert to nobody, so
-- the audit row can only be written from inside a trusted function. The check
-- is the first statement in each, so it cannot be reached around.

-- Raised on a version mismatch. `PT409` is PostgREST's convention for "return
-- HTTP 409", which is what the adapter maps to ConfigConflictError.
create function public.raise_bundle_conflict(p_expected integer, p_actual integer)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Bundle version conflict: expected %, found %', p_expected, p_actual
    using errcode = 'PT409',
          detail  = jsonb_build_object('expected', p_expected, 'actual', p_actual)::text;
end;
$$;

-- Creates or updates the shared header and appends the audit row. The item
-- tables are the caller's job, because they differ per vocabulary.
create function public.write_bundle_header(
  p_id               uuid,
  p_vocabulary       text,
  p_name             text,
  p_items            text[],
  p_expected_version integer,
  p_actor            uuid
)
returns public.config_bundles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.config_bundles;
  v_actual integer;
begin
  if p_id is null then
    insert into public.config_bundles (vocabulary, name, updated_by)
    values (p_vocabulary, p_name, p_actor)
    returning * into v_bundle;
  else
    -- The version predicate is in the UPDATE itself, not a preceding SELECT:
    -- a check-then-write is exactly the race this is meant to close.
    update public.config_bundles
       set name       = p_name,
           version    = version + 1,
           updated_at = now(),
           updated_by = p_actor
     where id = p_id
       and version = p_expected_version
    returning * into v_bundle;

    if not found then
      select version into v_actual from public.config_bundles where id = p_id;
      if v_actual is null then
        raise exception 'No config bundle %', p_id using errcode = 'PT404';
      end if;
      perform public.raise_bundle_conflict(p_expected_version, v_actual);
    end if;
  end if;

  insert into public.config_bundle_versions
    (bundle_id, version, vocabulary, name, items, updated_at, updated_by, action)
  values
    (v_bundle.id, v_bundle.version, v_bundle.vocabulary, v_bundle.name, p_items,
     v_bundle.updated_at, v_bundle.updated_by,
     case when p_id is null then 'created' else 'updated' end);

  return v_bundle;
end;
$$;

revoke execute on function
  public.write_bundle_header(uuid, text, text, text[], integer, uuid)
  from anon, authenticated, public;

revoke execute on function public.raise_bundle_conflict(integer, integer)
  from anon, authenticated, public;

-- Roles.
create function public.save_role_bundle(
  p_name             text,
  p_items            text[],
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
  if not public.has_permission('manage:roles') then
    raise exception 'manage:roles is required to write a role'
      using errcode = '42501';
  end if;

  v_bundle := public.write_bundle_header(
    p_id, 'permission', p_name, p_items, p_expected_version, auth.uid()
  );

  -- Replace rather than diff. The set is small, the semantics are obvious, and
  -- the delete fires `role_permissions_touch_state` for every holder — which
  -- is what has to happen whether an item was added or removed.
  delete from public.role_permissions where bundle_id = v_bundle.id;

  -- An unknown permission is rejected here by the foreign key, not by a check
  -- in application code that a second client could skip.
  insert into public.role_permissions (bundle_id, permission)
  select v_bundle.id, item from unnest(p_items) as item;

  return v_bundle;
end;
$$;

-- Route bundles.
create function public.save_route_bundle(
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

  return v_bundle;
end;
$$;

-- Deletion.
--
-- Holders are marked stale *before* the delete, deliberately. Removing the
-- bundle cascades into both `role_permissions` and `user_roles`, and nothing
-- orders those two cascades relative to each other — so the trigger that
-- normally finds holders may find none left. Doing it explicitly here is the
-- difference between every affected token being detectably stale and some of
-- them silently outliving the role.
create function public.delete_config_bundle(
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
    select coalesce(array_agg(template_key order by ordinal), '{}')
      into v_items
      from public.route_templates where bundle_id = p_id;
  end if;

  if v_bundle.version <> p_expected_version then
    perform public.raise_bundle_conflict(p_expected_version, v_bundle.version);
  end if;

  perform public.touch_permission_state(
    array(select user_id from public.user_roles where bundle_id = p_id)
  );

  -- The deletion gets a version of its own, one past the last live one. That
  -- row is the only record that the bundle ever existed, which is why
  -- `config_bundle_versions` carries no foreign key back to here.
  insert into public.config_bundle_versions
    (bundle_id, version, vocabulary, name, items, updated_at, updated_by, action)
  values
    (v_bundle.id, v_bundle.version + 1, v_bundle.vocabulary, v_bundle.name,
     v_items, now(), auth.uid(), 'deleted');

  delete from public.config_bundles where id = p_id;
end;
$$;
