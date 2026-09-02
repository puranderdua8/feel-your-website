-- Named content variants.
--
-- A "section" the CMS composes into a route is a (template key, variant)
-- pair: variant '' is the section's default / global content, a named
-- variant ('star', 'short', …) is an independently-selectable alternative —
-- a different icon in one route's card, a shorter copy block on one page.
-- Route composition (a later migration) references these pairs; this
-- migration only widens the content row's identity to include the variant.
--
-- Additive and defaulted: every existing row, and every existing call site,
-- means variant ''. Locale fallback still applies *within* a variant; there
-- is deliberately no fallback *between* variants — asking for a variant that
-- has no content is a clear miss (the shell renders its placeholder), not a
-- silent swap to whatever the default variant holds.

alter table public.content_items
  add column variant text not null default '';

alter table public.content_items
  drop constraint content_items_pkey,
  add  constraint content_items_pkey primary key (template_key, variant, locale);

comment on table public.content_items is
  'One row per (template key, variant, locale). variant '''' is the default/global content. Locale fallback and translated:false are resolved by the adapter, not stored here.';

-- The write RPCs gain `p_variant`, defaulted to '' so callers that never
-- author a variant (the shell; today''s CMS forms) are unchanged. The old
-- 3-arg overloads are dropped rather than left alongside — a defaulted 4th
-- argument makes a 3-arg call ambiguous while both signatures exist.

drop function public.save_content_item(text, text, jsonb);
drop function public.delete_content_item(text, text);

create function public.save_content_item(
  p_template_key text,
  p_locale       text,
  p_fields       jsonb,
  p_variant      text default ''
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

  insert into public.content_items (template_key, variant, locale, fields, updated_at)
  values (p_template_key, p_variant, p_locale, p_fields, now())
  on conflict (template_key, variant, locale) do update
    set fields = excluded.fields, updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

create function public.delete_content_item(
  p_template_key text,
  p_locale       text,
  p_variant      text default ''
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
   where template_key = p_template_key and variant = p_variant and locale = p_locale;
end;
$$;
