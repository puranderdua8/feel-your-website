---
"@feel-your-website/content-core": major
"@feel-your-website/content-adapter-memory": minor
"@feel-your-website/content-adapter-supabase": minor
---

Add a **variant** dimension to content.

Content is now identified by `(templateKey, variant, locale)`. Variant `""`
is the section's default / global content (everything today); a named
variant (`"star"`, `"short"`, …) is an independently-selectable
alternative the CMS will point a route's slot at.

Interface changes (all **append-only and defaulted**, so existing call
sites are unaffected):

- `Content` gains a required `variant: string` field. This is the breaking
  part — code constructing a `Content` literal must supply it (the adapters
  and one section-registry test are updated here).
- `ContentAdapter.getContent(templateKey, locale, variant?)` — `variant`
  defaults to `""`. An unknown variant of a known key returns `null`;
  there is **no** fallback between variants (unlike locale, which still
  falls back _within_ a variant).
- `ContentWriter.saveContentItem(templateKey, locale, fields, variant?)` and
  `deleteContentItem(templateKey, locale, variant?)` — default `""`.
- `ListContentQuery.variant?` — omitted lists only the default (`""`)
  rows; pass a name to list that variant's rows.

Supabase: new migration adds `content_items.variant` (`not null default
''`), repivots the primary key to `(template_key, variant, locale)`, and
widens `save_content_item` / `delete_content_item` with a defaulted
`p_variant`. The memory adapter's seed gains an optional `variants` map.
The shared contract suite gains a `content variants` block, run against
both adapters.
