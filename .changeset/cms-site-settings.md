---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-supabase": patch
---

Add a `SiteSettingsStore` for the configured content locales.

`@feel-your-website/content-core` gains `SiteLocale`, the `SiteSettingsStore`
interface (`getLocales` / `setLocales`), a `MemorySiteSettingsStore`, and
`FALLBACK_SITE_LOCALES` (`[{ en, English }]`, returned when nothing is
configured). Kept out of the `config_bundles` substrate and of
`ContentAdapter` — it is a single small key→value bag, not a versioned bundle
and not `Content`.

`@feel-your-website/content-adapter-supabase` gains
`SupabaseSiteSettingsStore`, backed by a new `site_settings` table (public
read; writes revoked and funnelled through the `save_site_setting` RPC gated
on `manage:content`) — migration `20260905000100`, seeded with the `locales`
row.

`apps/cms`: the header language switcher's locale set now comes from the
store via a new `listSiteLocales` BFF fn and the route loader, instead of the
`DEFAULT_SITE_LOCALES` code stub (kept only as the fetch-failed fallback).
