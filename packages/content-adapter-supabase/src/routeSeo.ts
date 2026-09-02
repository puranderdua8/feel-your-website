import type { RouteSeo } from "@feel-your-website/content-core";

/**
 * The `route_seo` / `published_route_seo` row shape, and the map from it to
 * `RouteSeo`.
 *
 * Duplicated in `config-bundle-supabase/src/routeSeo.ts` for the same reason
 * `CookieAdapter` is declared per-package: a tiny shared shape is not worth a
 * dependency edge between two adapters that otherwise never reference each
 * other. Keep the two copies identical.
 */
export interface RouteSeoRow {
  locale: string;
  title: string | null;
  description: string | null;
  canonical: string | null;
  og_image: string | null;
  keywords: string[] | null;
  robots: string | null;
}

/** Row → `RouteSeo`, omitting every null field so the object stays minimal. */
export function rowToRouteSeo(row: RouteSeoRow): RouteSeo {
  const seo: {
    title?: string;
    description?: string;
    canonical?: string;
    ogImage?: string;
    keywords?: readonly string[];
    robots?: string;
  } = {};
  if (row.title != null) seo.title = row.title;
  if (row.description != null) seo.description = row.description;
  if (row.canonical != null) seo.canonical = row.canonical;
  if (row.og_image != null) seo.ogImage = row.og_image;
  if (row.keywords != null && row.keywords.length > 0) seo.keywords = row.keywords;
  if (row.robots != null) seo.robots = row.robots;
  return seo;
}
