---
"@feel-your-website/content-core": minor
"@feel-your-website/config-bundle-supabase": major
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/content-adapter-supabase": patch
---

Drop the flat route model and fold the CMS Content tab away.

**Database** (migration `20260906000100`): drop `route_templates`, the
`save_route_bundle` wrapper and the `published_route_manifest` view.
`save_route_composition` stops mirroring into `route_templates`;
`delete_config_bundle`'s route branch reads the root `route_section_instances`
for its audit `items` array instead. `route_section_instances` +
`published_route_sections` have been the source of truth since B3.

**`@feel-your-website/config-bundle-supabase`**: `ConfigBundleStore` is now
permission-only — `ConfigBundleVocabulary` narrows to `"permission"` and the
route branches leave `SupabaseConfigBundleStore.create` / `update` /
`#attachItems`. `RouteCompositionWriter` gains `deleteComposition(bundleId,
expectedVersion, actor)`; `SupabaseRouteCompositionWriter` implements it via
the vocabulary-agnostic `delete_config_bundle` RPC, `MemoryContentAdapter`
over its seed, both covered by the shared contract.

**`apps/cms`**: the Routes tab's delete goes through the new
`deleteRouteComposition` BFF fn; `listRouteBundles` / `saveRouteBundle` and
`src/content/template-keys.ts` are gone. The **Content** tab is replaced by a
**Languages** tab — the UI-chrome message editor moves there, alongside a new
content-locale manager (`saveSiteLocales` → `SiteSettingsStore.setLocales`).
Raw-JSON content authoring is retired; the Sections tab is the schema-driven
replacement.

README updated to describe the section-tree authoring model.
