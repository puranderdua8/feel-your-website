-- Layout routes: `route_bundles.has_outlet` + two publish invariants.
--
-- A route is a *layout* when its section tree carries an `outlet` node (the
-- reserved `sectionKey = 'outlet'`), where the matched child renders. Two
-- rules follow, and this migration makes `save_route_composition` enforce them
-- transactionally, the same way it already enforces cycles and publish
-- ordering:
--
--   1. A route may not be published while its parent has no outlet — the child
--      would have nowhere to render inside the parent.
--   2. A route that has a published child may not be saved with a tree that has
--      no outlet — that would strand the child.
--
-- `has_outlet` is a denormalised cache (like `normalized_path` / `param_meta`):
-- `save_route_composition` is its only writer and *derives* it from the rows it
-- just wrote — it never trusts a caller-supplied value. Backfilled here from
-- the existing `route_section_instances`.

-- 1. Column + backfill ----------------------------------------------------

alter table public.route_bundles
  add column has_outlet boolean not null default false;

comment on column public.route_bundles.has_outlet is
  'Whether this route''s section tree contains an `outlet` node — i.e. it is a layout that can host a child. Derived by save_route_composition from route_section_instances; never set by a caller.';

update public.route_bundles rb
   set has_outlet = exists (
     select 1 from public.route_section_instances rsi
     where rsi.bundle_id = rb.bundle_id and rsi.section_key = 'outlet'
   );

-- 2. save_route_composition: derive has_outlet + enforce the two rules -----

create or replace function public.save_route_composition(
  p_id               uuid,
  p_name             text,
  p_path_segment     text,
  p_published        boolean,
  p_expected_version integer,
  p_tree             jsonb,
  p_items            text[],
  p_seo              jsonb default '{}'::jsonb,
  p_parent_id        uuid  default null,
  p_params           jsonb default '[]'::jsonb
)
returns public.config_bundles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.config_bundles;
  v_parent_path text;
  v_path text;
  v_normalized text;
  v_locale text;
  v_row jsonb;
  v_has_outlet boolean;
begin
  if not public.has_permission('manage:routes') then
    raise exception 'manage:routes is required to write a route bundle'
      using errcode = '42501';
  end if;

  -- Parent + cycle validation, before the header write so a rejection touches
  -- nothing.
  if p_parent_id is not null then
    if p_parent_id = p_id then
      raise exception 'a route cannot be its own parent' using errcode = 'PT422';
    end if;
    if not exists (select 1 from public.route_bundles where bundle_id = p_parent_id) then
      raise exception 'parent route % does not exist', p_parent_id using errcode = 'PT422';
    end if;
    if p_id is not null and exists (
      with recursive ancestors as (
        select parent_bundle_id
        from public.route_bundles where bundle_id = p_parent_id
        union
        select rb.parent_bundle_id
        from public.route_bundles rb
        join ancestors a on rb.bundle_id = a.parent_bundle_id
      )
      select 1 from ancestors where parent_bundle_id = p_id
    ) then
      raise exception 'that parent would create a cycle' using errcode = 'PT422';
    end if;
  end if;

  -- Publish invariants: a live child needs live ancestors; a parent cannot go
  -- back to draft while a child is live.
  if p_published and p_parent_id is not null and exists (
    with recursive chain as (
      select bundle_id, parent_bundle_id, published
      from public.route_bundles where bundle_id = p_parent_id
      union
      select rb.bundle_id, rb.parent_bundle_id, rb.published
      from public.route_bundles rb
      join chain c on rb.bundle_id = c.parent_bundle_id
    )
    select 1 from chain where not published
  ) then
    raise exception 'publish the parent route before publishing this one'
      using errcode = 'PT422';
  end if;

  if not p_published and p_id is not null and exists (
    select 1 from public.route_bundles where parent_bundle_id = p_id and published
  ) then
    raise exception 'unpublish or reparent the published child routes first'
      using errcode = 'PT422';
  end if;

  -- Layout invariant (1): a published child renders inside its parent, so the
  -- parent must carry an outlet. Read from the parent's stored `has_outlet` —
  -- this RPC is its only writer, so it is always current.
  if p_published and p_parent_id is not null
     and not coalesce(
       (select has_outlet from public.route_bundles where bundle_id = p_parent_id),
       false
     )
  then
    raise exception 'the parent route has no outlet — add one to it before publishing this route inside it'
      using errcode = 'PT422';
  end if;

  v_bundle := public.write_bundle_header(
    p_id, 'template_key', p_name, p_items, p_expected_version, auth.uid()
  );

  -- Compose this route's absolute pattern from the parent's.
  if p_parent_id is null then
    v_path := p_path_segment;
  else
    select path into v_parent_path from public.route_bundles where bundle_id = p_parent_id;
    v_path := v_parent_path || '/' || p_path_segment;
  end if;
  v_normalized := regexp_replace(v_path, ':[a-z][a-zA-Z0-9_]*', ':param', 'g');

  update public.config_bundle_versions
     set snapshot      = p_tree,
         snapshot_meta = jsonb_build_object(
           'pathSegment', p_path_segment,
           'parentId',    p_parent_id,
           'params',      coalesce(p_params, '[]'::jsonb)
         )
   where bundle_id = v_bundle.id and version = v_bundle.version;

  begin
    insert into public.route_bundles
      (bundle_id, path, path_segment, normalized_path, published, parent_bundle_id, param_meta)
    values
      (v_bundle.id, v_path, p_path_segment, v_normalized, p_published,
       p_parent_id, coalesce(p_params, '[]'::jsonb))
    on conflict (bundle_id) do update
      set path             = excluded.path,
          path_segment     = excluded.path_segment,
          normalized_path  = excluded.normalized_path,
          published        = excluded.published,
          parent_bundle_id = excluded.parent_bundle_id,
          param_meta       = excluded.param_meta;
  exception
    when unique_violation then
      raise exception 'a route already matches the path pattern "%"', v_path
        using errcode = 'PT422';
  end;

  -- A moved segment/parent shifts every descendant's absolute path.
  begin
    perform public.route_recompute_subtree_paths(v_bundle.id);
  exception
    when unique_violation then
      raise exception 'this change would collide a descendant route''s path with another route'
        using errcode = 'PT422';
  end;

  delete from public.route_section_instances where bundle_id = v_bundle.id;
  perform public.insert_route_section_nodes(v_bundle.id, null, null, p_tree);

  -- Derived from the rows just written — never a caller-supplied flag.
  v_has_outlet := exists (
    select 1 from public.route_section_instances
    where bundle_id = v_bundle.id and section_key = 'outlet'
  );
  update public.route_bundles set has_outlet = v_has_outlet where bundle_id = v_bundle.id;

  -- Layout invariant (2): the mirror of rule (1) — this route cannot drop its
  -- outlet while a published child depends on it.
  if not v_has_outlet and exists (
    select 1 from public.route_bundles
    where parent_bundle_id = v_bundle.id and published
  ) then
    raise exception 'this route has a published child that renders inside it — it must keep its outlet'
      using errcode = 'PT422';
  end if;

  delete from public.route_seo where bundle_id = v_bundle.id;
  if p_seo is not null and jsonb_typeof(p_seo) = 'object' then
    for v_locale, v_row in select key, value from jsonb_each(p_seo)
    loop
      insert into public.route_seo
        (bundle_id, locale, title, description, canonical, og_image, keywords, robots)
      values (
        v_bundle.id,
        v_locale,
        v_row ->> 'title',
        v_row ->> 'description',
        v_row ->> 'canonical',
        v_row ->> 'ogImage',
        case
          when jsonb_typeof(v_row -> 'keywords') = 'array'
            then array(select jsonb_array_elements_text(v_row -> 'keywords'))
          else null
        end,
        v_row ->> 'robots'
      );
    end loop;
  end if;

  return v_bundle;
end;
$$;
