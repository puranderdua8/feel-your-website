-- Two guardrails for CMS-generated file routes: a stable `route_key` and an
-- `offline` flag.
--
-- `route_key` is a slug, unique and immutable after creation, that generated
-- route files and cross-environment lookups key off instead of `bundle_id`
-- (a UUID that differs per database, so it can never appear in committed
-- source). Seeded once from `path` at creation; `save_route_composition`
-- never overwrites it on an update, the same way `has_outlet` is
-- never caller-supplied.
--
-- `offline` marks a route for service-worker precaching. Only allowed on a
-- route with no path params — an offline route must be fully renderable with
-- no author-supplied data at request time.
--
-- The slug rule (`^[a-z0-9][a-z0-9-]*$` on every static segment of `path`)
-- also lands here: it is a guardrail on every route, not just offline ones,
-- so a generated file never needs characters TanStack's file-routing syntax
-- reserves (`.`, `_`, `-` is fine, `(…)`, `$`). Checked against `path`, the
-- full absolute pattern, not `path_segment` — a top-level route's
-- `path_segment` *is* an absolute pattern (leading slash and all), so
-- checking it directly against a single-segment regex would reject every
-- existing top-level route. Added `not valid` first, since it constrains
-- existing data, then validated immediately below once the audit confirms
-- nothing violates it — left `not valid` with a `notice` otherwise, for a
-- manual fix-up pass.

-- 1. route_key --------------------------------------------------------------

create function public.route_key_from_path(p_path text)
returns text
language sql
immutable
as $$
  select case
    when p_path = '/' then 'home'
    else regexp_replace(regexp_replace(trim(both '/' from p_path), ':', '', 'g'), '/', '-', 'g')
  end;
$$;

comment on function public.route_key_from_path(text) is
  'Derives a route_key seed from a path pattern: strips leading/trailing slashes and `:` markers, folds remaining `/` to `-`. Used once at row creation (backfill here, save_route_composition thereafter) — never to recompute an existing route_key, which is immutable.';

alter table public.route_bundles
  add column route_key text;

comment on column public.route_bundles.route_key is
  'Stable, human-readable identity for this route, independent of the environment-specific bundle_id. Seeded once from path at creation; generated route files and ContentAdapter.getRouteByKey key off this, never bundle_id. Immutable after creation — save_route_composition sets it only on insert.';

with seeded as (
  select bundle_id, public.route_key_from_path(path) as base_key
  from public.route_bundles
),
deduped as (
  select
    bundle_id,
    case
      when count(*) over (partition by base_key) = 1 then base_key
      -- Two different paths can slugify to the same base key (e.g. `/blog-post`
      -- and a nested `/blog/post`). Disambiguate deterministically rather than
      -- fail the migration; a real collision is rare enough that a short
      -- bundle_id suffix is an acceptable one-time backfill outcome.
      else base_key || '-' || substr(bundle_id::text, 1, 8)
    end as final_key
  from seeded
)
update public.route_bundles rb
   set route_key = d.final_key
  from deduped d
 where rb.bundle_id = d.bundle_id;

alter table public.route_bundles
  alter column route_key set not null;

create unique index route_bundles_route_key_key
  on public.route_bundles (route_key);

-- 2. Slug rule on every static segment of `path` (all routes) ---------------
--
-- Checked against `path` (the full absolute pattern), not `path_segment`: a
-- top-level route's `path_segment` *is* an absolute pattern (`/blog`, leading
-- slash and every internal `/`), so checking it directly against a
-- single-segment regex would reject every existing top-level route. `path`
-- is always the complete, already-composed pattern regardless of how deep the
-- route sits in the parent chain, so splitting *it* on `/` and checking each
-- piece is correct uniformly for a root, a nested child, or a flat
-- multi-segment top-level route alike.

-- A CHECK constraint's own expression cannot contain a subquery — even one
-- that only unnests a value from the same row, with no table in its FROM —
-- so the per-segment check is a function, called from the constraint, rather
-- than inlined.
create function public.route_path_segments_ok(p_path text)
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1 from unnest(string_to_array(trim(leading '/' from p_path), '/')) as seg
    where seg !~ '^[a-z0-9][a-z0-9-]*$' and seg !~ '^:[a-z][a-zA-Z0-9_]*$'
  );
$$;

comment on function public.route_path_segments_ok(text) is
  'True when every segment of an absolute path pattern is either a slug (^[a-z0-9][a-z0-9-]*$) or a `:name` param. Backs route_bundles_slug_rule.';

alter table public.route_bundles
  add constraint route_bundles_slug_rule
  check (public.route_path_segments_ok(path)) not valid;

do $$
declare
  v_bad_count integer;
begin
  select count(*) into v_bad_count
    from public.route_bundles
   where not public.route_path_segments_ok(path);

  if v_bad_count = 0 then
    alter table public.route_bundles validate constraint route_bundles_slug_rule;
  else
    raise notice 'route_bundles_slug_rule left NOT VALID: % existing row(s) violate the slug rule (^[a-z0-9][a-z0-9-]*$) on some segment of path and need a manual fix before `alter table route_bundles validate constraint route_bundles_slug_rule` can run',
      v_bad_count;
  end if;
end $$;

-- 3. offline ------------------------------------------------------------

alter table public.route_bundles
  add column offline boolean not null default false;

comment on column public.route_bundles.offline is
  'Whether this route is precached by the service worker for offline navigation. Only allowed on a route with no path params.';

alter table public.route_bundles
  add constraint route_bundles_offline_no_params
  check (not offline or jsonb_array_length(param_meta) = 0);

-- 4. save_route_composition: thread p_offline, set route_key only on insert -
--
-- `create or replace function` only replaces a function with the exact same
-- argument list — adding `p_offline` makes this a *different* signature, so
-- `create or replace` alone would silently leave the old 10-arg version
-- standing alongside this 11-arg one as two overloads. Caught by actually
-- running this migration locally: PostgREST/callers omitting the trailing
-- optional args would then hit "function ... is not unique". Drop the old
-- signature explicitly first, the same way `20260913000100` dropped the
-- deprecated 8-arg wrapper once nothing called it — there is no rollout
-- window to preserve here, so there is no reason to keep both.
drop function if exists public.save_route_composition(
  uuid, text, text, boolean, integer, jsonb, text[], jsonb, uuid, jsonb
);

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
  p_params           jsonb default '[]'::jsonb,
  p_offline          boolean default false
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
  v_constraint text;
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

  -- offline ⇒ no params. Checked here too (not just the table constraint) so
  -- a violation surfaces as the same friendly PT422 shape as every other
  -- write-time invariant, rather than a raw constraint-violation message.
  if p_offline and jsonb_array_length(coalesce(p_params, '[]'::jsonb)) > 0 then
    raise exception 'an offline route cannot take path params — it must be reachable with no author-supplied data'
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
      (bundle_id, path, path_segment, normalized_path, published, parent_bundle_id,
       param_meta, offline, route_key)
    values
      (v_bundle.id, v_path, p_path_segment, v_normalized, p_published,
       p_parent_id, coalesce(p_params, '[]'::jsonb), p_offline,
       -- Set once, on the row's first insert. A later `on conflict` on the
       -- same bundle_id never appears in this VALUES clause's evaluation
       -- again for route_key below — it is deliberately absent from the
       -- `do update set` list.
       coalesce(
         (select route_key from public.route_bundles where bundle_id = v_bundle.id),
         public.route_key_from_path(v_path)
       ))
    on conflict (bundle_id) do update
      set path             = excluded.path,
          path_segment     = excluded.path_segment,
          normalized_path  = excluded.normalized_path,
          published        = excluded.published,
          parent_bundle_id = excluded.parent_bundle_id,
          param_meta       = excluded.param_meta,
          offline          = excluded.offline;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'route_bundles_route_key_key' then
        raise exception 'this route''s generated key collides with another route''s — adjust the path slightly so the keys no longer collide'
          using errcode = 'PT422';
      end if;
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

-- 5. Views: expose route_key + offline ---------------------------------
--
-- `create or replace view` requires every pre-existing column to keep the
-- same name at the same ordinal position — it can only *append* new columns
-- at the end. `route_key`/`offline` go after `param_meta` (this view's
-- previous last column) rather than beside `path`, or Postgres rejects the
-- whole statement with "cannot change name of view column ... to ..." (the
-- old position of `route_key`/`offline` would have shifted `version` etc.
-- one slot over). Caught by actually running this migration locally.

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
  coalesce(
    (
      select jsonb_object_agg(rsc.locale, rsc.fields)
      from public.route_section_content rsc
      where rsc.instance_id = rsi.id
    ),
    '{}'::jsonb
  ) as content,
  rb.parent_bundle_id,
  rb.param_meta,
  rb.route_key,
  rb.offline
from public.config_bundles cb
join public.route_bundles rb on rb.bundle_id = cb.id
join public.route_section_instances rsi on rsi.bundle_id = cb.id
where cb.vocabulary = 'template_key'
  and rb.published;

grant select on public.published_route_sections to anon, authenticated;

create or replace view public.published_route_headers
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
  ) as title,
  rb.route_key,
  rb.offline
from public.route_bundles rb
join public.config_bundles cb on cb.id = rb.bundle_id
where cb.vocabulary = 'template_key'
  and rb.published;

comment on view public.published_route_headers is
  'Read model for ContentAdapter.getRouteHeaders(). One row per published route — id, path pattern, parent, param metadata, route_key, offline, and a locale -> title map — with no section rows.';

grant select on public.published_route_headers to anon, authenticated;
