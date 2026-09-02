-- Per-route SEO metadata.
--
-- Route nodes carry their per-locale content (20260907000100); this adds the
-- route-level `<head>` metadata the shell needs — title, description,
-- canonical, og:image, keywords, robots — per locale, authored alongside the
-- tree. Same storage shape as route_section_content: flat rows, written only
-- through `save_route_composition`, read published via a view and as-drafts by
-- a route author, cascade-deleted with the bundle.

create table public.route_seo (
  bundle_id   uuid        not null references public.config_bundles (id) on delete cascade,
  locale      text        not null,
  title       text,
  description text,
  canonical   text,
  og_image    text,
  keywords    text[],
  robots      text,
  updated_at  timestamptz not null default now(),
  primary key (bundle_id, locale)
);

comment on table public.route_seo is
  'One row per (route bundle, locale). Every field optional. Folded onto RouteBundle.seo by the adapter (locale -> RouteSeo), not by SQL.';

alter table public.route_seo enable row level security;

create policy route_seo_read_published
  on public.route_seo
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.route_bundles rb
      where rb.bundle_id = route_seo.bundle_id and rb.published
    )
  );

create policy route_seo_read_authors
  on public.route_seo
  for select
  to authenticated
  using (public.has_permission('manage:routes'));

-- The published read model. SEO is per-bundle, not per-instance, so it is its
-- own view rather than a column on published_route_sections (which would
-- repeat every bundle's SEO on each of its section rows). The adapter fetches
-- it alongside the sections and folds by bundle_id.
create view public.published_route_seo
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
  rs.robots
from public.route_seo rs
join public.route_bundles rb on rb.bundle_id = rs.bundle_id
where rb.published;

grant select on public.published_route_seo to anon, authenticated;

-- save_route_composition gains `p_seo` — an object `{ <locale>: RouteSeo }`,
-- replaced wholesale with the tree. A new argument means dropping the old
-- 7-arg signature and recreating (CREATE OR REPLACE cannot change the arg
-- list); `p_seo` is defaulted so a caller that omits it clears the route's
-- SEO rather than erroring.
drop function public.save_route_composition(uuid, text, text, boolean, integer, jsonb, text[]);

create function public.save_route_composition(
  p_id               uuid,
  p_name             text,
  p_path             text,
  p_published        boolean,
  p_expected_version integer,
  p_tree             jsonb,
  p_items            text[],
  p_seo              jsonb default '{}'::jsonb
)
returns public.config_bundles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle public.config_bundles;
  v_locale text;
  v_row    jsonb;
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

  -- Replace the whole SEO set. route_seo has no FK to route_section_instances,
  -- so unlike route_section_content it is cleared explicitly here.
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
