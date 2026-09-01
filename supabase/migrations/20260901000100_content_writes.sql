-- Writing content and messages.
--
-- `..._content.sql` deliberately left this out, with a comment pointing here:
-- `content_items`/`content_messages` are public-read with every write revoked
-- from anon/authenticated, and no RPC existed yet. This is that RPC.
--
-- Unlike `save_role_bundle`/`save_route_bundle`, there is no optimistic
-- concurrency here — `ContentWriter` (see @feel-your-website/content-core)
-- carries no version field for the same reason `Content` itself does not
-- (see that package's own note): content is a single field-bag per
-- (template key, locale) or (locale, key), not a versioned, audited bundle
-- drawn from a fixed vocabulary. Two editors racing on the same row is a
-- real possibility the CMS UI should warn about, but the database's job here
-- is upsert-and-stamp, not arbitrate.
--
-- SECURITY DEFINER with `has_permission('manage:content')` as the first
-- statement, same pattern as the config-bundle writes: wide EXECUTE grant
-- (Postgres's default for a new function), authorization enforced inside.

create function public.save_content_item(
  p_template_key text,
  p_locale       text,
  p_fields       jsonb
)
returns public.content_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.content_items;
begin
  if not public.has_permission('manage:content') then
    raise exception 'manage:content is required to write content'
      using errcode = '42501';
  end if;

  insert into public.content_items (template_key, locale, fields, updated_at)
  values (p_template_key, p_locale, p_fields, now())
  on conflict (template_key, locale) do update
    set fields = excluded.fields, updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

create function public.delete_content_item(
  p_template_key text,
  p_locale       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('manage:content') then
    raise exception 'manage:content is required to delete content'
      using errcode = '42501';
  end if;

  delete from public.content_items
   where template_key = p_template_key and locale = p_locale;
end;
$$;

create function public.save_content_message(
  p_locale text,
  p_key    text,
  p_value  text
)
returns public.content_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.content_messages;
begin
  if not public.has_permission('manage:content') then
    raise exception 'manage:content is required to write a message'
      using errcode = '42501';
  end if;

  insert into public.content_messages (locale, key, value, updated_at)
  values (p_locale, p_key, p_value, now())
  on conflict (locale, key) do update
    set value = excluded.value, updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

create function public.delete_content_message(
  p_locale text,
  p_key    text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('manage:content') then
    raise exception 'manage:content is required to delete a message'
      using errcode = '42501';
  end if;

  delete from public.content_messages
   where locale = p_locale and key = p_key;
end;
$$;
