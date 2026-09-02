---
"@feel-your-website/content-core": major
"@feel-your-website/content-adapter-memory": major
"@feel-your-website/content-adapter-supabase": major
---

Drop the section-content store.

`content_items` — content keyed by (template key, variant, locale), shared
across every route that referenced a section — is gone. Since PRs #24–#27
content lives on route section instances (`route_section_content`) and route
metadata on `route_seo`; nothing read or wrote `content_items` any more.

- **`@feel-your-website/content-core`**: `ContentAdapter` loses `getContent`
  and `listContent` (its surface is `getRouteManifest` + `getMessages`);
  `ContentWriter` loses `saveContentItem` / `deleteContentItem` (messages
  only). The `Content`, `ListContentQuery` and `Page` types are removed, and
  `CONTRACT_FIXTURE` is trimmed to locale config.
- **`@feel-your-website/content-adapter-memory`**: `MemoryContentSeed` loses
  `content` and `variants`; the adapter loses the matching methods and its
  cursor machinery.
- **`@feel-your-website/content-adapter-supabase`**: `SupabaseContentAdapter`
  loses `getContent` / `listContent` and its `defaultLocale` option;
  `SupabaseContentWriter` loses the item methods; `writer.live.test.ts` is
  removed and the contract suite no longer serialises with it.
- Migration `20260909000100_drop_content_items.sql` drops the table and the
  `save_content_item` / `delete_content_item` RPCs. `content_messages` stays.
- `apps/shell` loses the unused `loadContent` server function.

Requires the migration to be applied to the hosted project
(`pnpm exec supabase db push`) and recorded in `supabase/migrations/applied.txt`.
