-- Route hierarchy and path parameters.
--
-- A route bundle can now name a parent (`parent_bundle_id`) and store only its
-- own contribution to the path (`path_segment`) — the full path for a
-- top-level route (`/blog`), a single segment for a nested one (`:slug`). The
-- absolute pattern lives in `path` (derived, kept in sync by
-- `route_recompute_subtree_paths`), and `normalized_path` is that pattern with
-- every `:name` folded to `:param` — carrying a `unique` index so two routes
-- that match the same set of URLs (`/blog/:slug` vs `/blog/:id`) cannot both
-- exist, whoever writes them.
--
-- The tree assembly and `insert_route_section_nodes` are unchanged: an `outlet`
-- marker node (added by the app in PR 3) stores like any other leaf.

-- 1. Columns + constraints -------------------------------------------------

alter table public.route_bundles
  -- A parent must itself be a route. `on delete restrict` so a parent cannot
  -- be deleted out from under its children (the RPCs raise a friendlier error
  -- first; this is the backstop).
  add column parent_bundle_id uuid references public.route_bundles (bundle_id) on delete restrict,
  -- This route's own path contribution. Backfilled below, then NOT NULL.
  add column path_segment     text,
  -- The absolute pattern with `:name` -> `:param`. Derived; unique.
  add column normalized_path  text,
  -- Ordered [{ "name": "slug", "label": "Post slug" }], one per `:name` in `path`.
  add column param_meta        jsonb not null default '[]'::jsonb;

comment on column public.route_bundles.parent_bundle_id is
  'Parent route for layout nesting, breadcrumbs and site nav. NULL = top-level.';
comment on column public.route_bundles.path_segment is
  'This route''s own path contribution: the whole path for a top-level route, one segment for a nested one. The stored source of truth; `path` is derived from it and the parent chain.';
comment on column public.route_bundles.normalized_path is
  'Absolute `path` with every `:name` folded to `:param`. `unique` — two routes matching the same URLs cannot coexist. Kept in TypeScript parity by `route-match.ts`''s `normalizePattern`.';
comment on column public.route_bundles.param_meta is
  'Author metadata for the path''s `:name` parameters: [{ name, label }, ...], in order.';

-- Every existing route is flat and top-level.
update public.route_bundles
   set path_segment    = path,
       normalized_path = regexp_replace(path, ':[a-z][a-zA-Z0-9_]*', ':param', 'g')
 where path_segment is null;

alter table public.route_bundles
  alter column path_segment    set not null,
  alter column normalized_path set not null;

create unique index route_bundles_normalized_path_key
  on public.route_bundles (normalized_path);
create index route_bundles_by_parent
  on public.route_bundles (parent_bundle_id);

-- The audit snapshot stays the bare section tree; the authored path/parent/params
-- go in a sibling column so nothing that reads `snapshot` has to change.
alter table public.config_bundle_versions
  add column snapshot_meta jsonb;

comment on column public.config_bundle_versions.snapshot_meta is
  'For the template_key vocabulary: { pathSegment, parentId, params } as authored. Null for role bundles and pre-hierarchy history.';

-- 2. Recompute helper ---------------------------------------------------

-- Rewrites `path` + `normalized_path` for `p_root` and every descendant from
-- `path_segment` and the parent chain. Called by `save_route_composition`
-- after a route's segment or parent changes; a no-op when nothing moved.
-- Confined to write-time path bookkeeping — tree *assembly* still happens in
-- TypeScript (`assembleSectionTree`), never in SQL.
create function public.route_recompute_subtree_paths(p_root uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  for v_row in
    with recursive subtree as (
      select bundle_id, parent_bundle_id, path_segment, 0 as depth
      from public.route_bundles
      where bundle_id = p_root
      union
      select c.bundle_id, c.parent_bundle_id, c.path_segment, s.depth + 1
      from public.route_bundles c
      join subtree s on c.parent_bundle_id = s.bundle_id
    )
    select bundle_id, parent_bundle_id, path_segment, depth
    from subtree
    order by depth
  loop
    -- Shallower rows are updated first, so a child reads its parent's fresh path.
    update public.route_bundles rb
       set path = case
             when v_row.parent_bundle_id is null then v_row.path_segment
             else (
               select p.path from public.route_bundles p
               where p.bundle_id = v_row.parent_bundle_id
             ) || '/' || v_row.path_segment
           end
     where rb.bundle_id = v_row.bundle_id;

    update public.route_bundles rb
       set normalized_path = regexp_replace(rb.path, ':[a-z][a-zA-Z0-9_]*', ':param', 'g')
     where rb.bundle_id = v_row.bundle_id;
  end loop;
end;
$$;

revoke execute on function public.route_recompute_subtree_paths(uuid)
  from anon, authenticated, public;

-- 3. save_route_composition -------------------------------------------------

-- The arg list changes (`p_path` -> `p_path_segment`, plus `p_parent_id` /
-- `p_params`), so drop and recreate.
drop function public.save_route_composition(uuid, text, text, boolean, integer, jsonb, text[], jsonb);

create function public.save_route_composition(
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

-- 4. delete_config_bundle: refuse a route that still has children -----------

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
    if exists (select 1 from public.route_bundles where parent_bundle_id = p_id) then
      raise exception 'route bundle % still has child routes — delete them first, or use delete_route_subtree', p_id
        using errcode = 'PT422';
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

-- 5. delete_route_subtree: the explicit, confirmed recursive delete --------

create function public.delete_route_subtree(
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
  v_row    record;
begin
  if not public.has_permission('manage:routes') then
    raise exception 'manage:routes is required to delete a route bundle'
      using errcode = '42501';
  end if;

  select * into v_bundle from public.config_bundles where id = p_id;
  if not found then
    raise exception 'No config bundle %', p_id using errcode = 'PT404';
  end if;
  if v_bundle.vocabulary <> 'template_key' then
    raise exception 'delete_route_subtree is for route bundles only'
      using errcode = 'PT422';
  end if;
  if v_bundle.version <> p_expected_version then
    perform public.raise_bundle_conflict(p_expected_version, v_bundle.version);
  end if;

  -- Deepest first, so `parent_bundle_id`'s `on delete restrict` is satisfied.
  -- The `config_bundles` delete cascades route_bundles + section instances +
  -- content + seo for each row.
  for v_row in
    with recursive subtree as (
      select bundle_id, 0 as depth from public.route_bundles where bundle_id = p_id
      union
      select c.bundle_id, s.depth + 1
      from public.route_bundles c
      join subtree s on c.parent_bundle_id = s.bundle_id
    )
    select st.bundle_id, cb.version, cb.vocabulary, cb.name, st.depth
    from subtree st
    join public.config_bundles cb on cb.id = st.bundle_id
    order by st.depth desc
  loop
    perform public.touch_permission_state(
      array(select user_id from public.user_roles where bundle_id = v_row.bundle_id)
    );

    insert into public.config_bundle_versions
      (bundle_id, version, vocabulary, name, items, updated_at, updated_by, action)
    values (
      v_row.bundle_id, v_row.version + 1, v_row.vocabulary, v_row.name,
      coalesce(
        (select array_agg(section_key order by ordinal)
         from public.route_section_instances
         where bundle_id = v_row.bundle_id and parent_instance_id is null),
        '{}'
      ),
      now(), auth.uid(), 'deleted'
    );

    delete from public.config_bundles where id = v_row.bundle_id;
  end loop;
end;
$$;

-- Public-facing, like `delete_config_bundle` / `save_route_composition`: called
-- straight from the app and gated by its own `has_permission` check, so
-- `execute` is not revoked from `authenticated`.

-- 6. Views ---------------------------------------------------------------

-- Both published views gain the hierarchy columns, appended at the end so
-- `create or replace view` is allowed.
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
  ) as content,
  rb.parent_bundle_id,
  rb.param_meta
from public.config_bundles cb
join public.route_bundles rb on rb.bundle_id = cb.id
join public.route_section_instances rsi on rsi.bundle_id = cb.id
where cb.vocabulary = 'template_key'
  and rb.published;

grant select on public.published_route_sections to anon, authenticated;

create or replace view public.published_route_seo
  with (security_invoker = true)
as
select
  rs.bundle_id,
  rb.path,
  rs.locale,
  rs.title,
  rs.description,
  rs.canonical,
  rs.og_image,
  rs.keywords,
  rs.robots,
  rb.parent_bundle_id
from public.route_seo rs
join public.route_bundles rb on rb.bundle_id = rs.bundle_id
where rb.published;

grant select on public.published_route_seo to anon, authenticated;

-- A section-tree-free read model for the shell's site nav / breadcrumbs, so
-- `getRouteHeaders()` never pulls `published_route_sections`.
create view public.published_route_headers
  with (security_invoker = true)
as
select
  rb.bundle_id,
  rb.path,
  rb.path_segment,
  rb.parent_bundle_id,
  rb.param_meta,
  coalesce(
    (
      select jsonb_object_agg(rs.locale, rs.title)
      from public.route_seo rs
      where rs.bundle_id = rb.bundle_id and rs.title is not null
    ),
    '{}'::jsonb
  ) as title
from public.route_bundles rb
join public.config_bundles cb on cb.id = rb.bundle_id
where cb.vocabulary = 'template_key'
  and rb.published;

comment on view public.published_route_headers is
  'Read model for ContentAdapter.getRouteHeaders(). One row per published route — id, path pattern, parent, param metadata, and a locale -> title map — with no section rows.';

grant select on public.published_route_headers to anon, authenticated;
