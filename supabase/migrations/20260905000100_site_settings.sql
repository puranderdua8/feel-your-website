-- Site-wide settings the CMS authors — starting with the set of content
-- locales the language switcher and the publish-completeness gate iterate.
--
-- A plain key→jsonb bag, not the `config_bundles` substrate: no version, no
-- audit trail, no fixed vocabulary. Public read (a site visitor's language
-- menu needs it), writes revoked from every client role and funnelled through
-- one SECURITY DEFINER RPC gated on `manage:content` — the same shape as
-- `content_items` / `save_content_item`.

create table public.site_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is
  'CMS-authored site settings, one row per key. `locales` holds [{locale,label}] — the configured content languages, first is default.';

alter table public.site_settings enable row level security;

create policy site_settings_read
  on public.site_settings for select to anon, authenticated using (true);

revoke insert, update, delete on public.site_settings from anon, authenticated;

-- Seed the one key the app reads today. `on conflict do nothing` so a replay
-- against a database where an editor has already changed it is a no-op.
insert into public.site_settings (key, value) values
  ('locales', '[{"locale": "en", "label": "English"}]'::jsonb)
on conflict (key) do nothing;

create function public.save_site_setting(
  p_key   text,
  p_value jsonb
)
returns public.site_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.site_settings;
begin
  if not public.has_permission('manage:content') then
    raise exception 'manage:content is required to write site settings'
      using errcode = '42501';
  end if;

  insert into public.site_settings (key, value, updated_at)
  values (p_key, p_value, now())
  on conflict (key) do update
    set value = excluded.value, updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;
