-- Drop the section-content store.
--
-- `content_items` was the old model: content keyed by (template key, variant,
-- locale), shared across every route that referenced a section. Since PRs
-- #25–#27 the content lives on route section instances
-- (`route_section_content`) and route metadata on `route_seo`; the shell
-- renders from the manifest tree and the CMS authors per route. Nothing reads
-- or writes `content_items` any more.
--
-- `content_messages` stays — `getMessages` still serves UI-chrome strings from
-- it, and `save_content_message` / `delete_content_message` are unaffected.

drop function if exists public.save_content_item(text, text, jsonb, text);
drop function if exists public.delete_content_item(text, text, text);
drop table if exists public.content_items;
