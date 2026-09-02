---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": minor
"@feel-your-website/content-adapter-supabase": minor
"@feel-your-website/config-bundle-supabase": minor
---

Per-route, per-locale SEO metadata.

`@feel-your-website/content-core`: new `RouteSeo` (title, description,
canonical, ogImage, keywords, robots — all optional); `RouteBundle`,
`RouteComposition` and `RouteCompositionInput` gain `seo: Record<Locale,
RouteSeo>`, replaced wholesale with the tree.

`@feel-your-website/content-adapter-memory`: seeds and round-trips `seo`; the
`/help` fixture carries a title + description in both locales.

Migration `20260908000100_route_seo.sql`: a `route_seo` table (one row per
bundle+locale, every field nullable, RLS following the published flag, cascade
with the bundle), a `published_route_seo` view, and `save_route_composition`
gains `p_seo` (the old 7-arg signature is dropped and recreated). The Supabase
`getRouteManifest` / `getComposition` fold it onto `RouteBundle.seo`; the
writer sends `p_seo`.

`apps/cms`: an SEO panel in the route editor, per locale, saved with the
route. `apps/shell`: `loadRoutePage` resolves `seo` for the negotiated
locale, and the catch-all route's `head()` emits `<title>`, description,
`og:*`, keywords, robots and a canonical `<link>`.

Requires the migration to be applied to the hosted project
(`pnpm exec supabase db push`) and recorded in `supabase/migrations/applied.txt`.
