---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": minor
---

Add the read side of route composition and the CMS BFF for it.

`@feel-your-website/content-core` gains `RouteComposition` (a route's tree
plus its `name` / `published` header) and `RouteCompositionReader`
(`getComposition(bundleId)`) — the draft-inclusive read the editor needs, and
which `ContentAdapter.getRouteManifest` (published-only) cannot serve.

`MemoryContentAdapter` now also implements `RouteCompositionReader` over its
seed; `RouteSeed` carries optional `name` / `published`, and
`getRouteManifest` filters out drafts (`published === false`).

`@feel-your-website/config-bundle-supabase` gains
`SupabaseRouteCompositionReader` — reads `config_bundles` + `route_bundles` +
`route_section_instances` for one bundle with the signed-in session, so a
route author sees their own drafts, and assembles the tree with
`assembleSectionTree`.

`apps/cms`: `getRouteCompositionReader` / `getRouteCompositionWriter` in
`adapters.ts`, and four BFF functions — `loadRouteComposition`,
`saveRouteComposition` (validates the tree against the section catalog before
writing), and `checkRoutePublishReadiness` (walks `collectEffectiveRefs` ×
the configured site locales, calling `getContent` + `validateSectionFields`,
treating a locale-fallback as missing). No UI yet — that is the next slice.
