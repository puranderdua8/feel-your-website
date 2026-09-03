import {
  assembleSectionTree,
  type FlatSectionRow,
  type JsonValue,
  type RouteComposition,
  type RouteCompositionReader,
  type RouteCompositionSummary,
  type RouteParamSpec,
  type RouteSeo,
} from "@feel-your-website/content-core";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapRouteCompositionError } from "./mapRouteCompositionError.js";
import { type RouteSeoRow, rowToRouteSeo } from "./routeSeo.js";

export interface SupabaseRouteCompositionReaderOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. */
  anonKey: string;
  /**
   * The session — a route author reads their own drafts through the
   * `*_read_authors` RLS policies (`has_permission('manage:routes')`), which
   * need the signed-in session, not a bare anon key.
   */
  cookies: CookieAdapter;
}

interface RouteBundleMeta {
  path: string;
  path_segment: string;
  published: boolean;
  parent_bundle_id: string | null;
  param_meta: unknown;
}

interface HeaderRow {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  route_bundles: RouteBundleMeta | RouteBundleMeta[] | null;
}

/** Coerces the `param_meta` JSON into `RouteParamSpec[]`, dropping junk. */
function toParamSpecs(raw: unknown): RouteParamSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name === "") return [];
    return [
      {
        name: record.name,
        label: typeof record.label === "string" ? record.label : record.name,
      },
    ];
  });
}

interface InstanceRow {
  id: string;
  parent_instance_id: string | null;
  parent_slot: string | null;
  ordinal: number;
  section_key: string;
  /** Embedded from route_section_content — one entry per authored locale. */
  route_section_content: { locale: string; fields: Record<string, JsonValue> }[] | null;
}

/**
 * `RouteCompositionReader` backed by Supabase — the draft-inclusive read the
 * CMS editor needs. Reads `config_bundles` + `route_bundles` +
 * `route_section_instances` for one bundle with the signed-in session, so
 * unpublished routes are visible to their author; `assembleSectionTree`
 * builds the tree in TypeScript, same as `SupabaseContentAdapter`.
 */
export class SupabaseRouteCompositionReader implements RouteCompositionReader {
  readonly #client: SupabaseClient;

  constructor(options: SupabaseRouteCompositionReaderOptions) {
    this.#client = createServerClient(options.url, options.anonKey, {
      cookies: {
        getAll: async () => await options.cookies.getAll(),
        setAll: async (cookies, headers) => {
          await options.cookies.setAll(cookies, headers);
        },
      },
    });
  }

  async listCompositions(): Promise<readonly RouteCompositionSummary[]> {
    const { data, error } = await this.#client
      .from("config_bundles")
      .select(
        "id, name, version, updated_at, route_bundles!inner(path, path_segment, published, parent_bundle_id, param_meta)",
      )
      .eq("vocabulary", "template_key")
      .order("name");
    if (error) throw mapRouteCompositionError(error);

    return ((data ?? []) as HeaderRow[]).flatMap((row) => {
      const meta = Array.isArray(row.route_bundles) ? row.route_bundles[0] : row.route_bundles;
      if (!meta) return [];
      return [
        {
          id: row.id,
          name: row.name,
          path: meta.path,
          pathSegment: meta.path_segment,
          parentId: meta.parent_bundle_id ?? null,
          published: meta.published,
          version: row.version,
          updatedAt: row.updated_at,
        },
      ];
    });
  }

  async getComposition(bundleId: string): Promise<RouteComposition | null> {
    const { data: header, error: headerError } = await this.#client
      .from("config_bundles")
      .select(
        "id, name, version, updated_at, route_bundles(path, path_segment, published, parent_bundle_id, param_meta)",
      )
      .eq("id", bundleId)
      .eq("vocabulary", "template_key")
      .maybeSingle<HeaderRow>();
    if (headerError) throw mapRouteCompositionError(headerError);
    if (!header) return null;

    const routeMeta = Array.isArray(header.route_bundles)
      ? header.route_bundles[0]
      : header.route_bundles;
    if (!routeMeta) return null;

    const [{ data: rows, error: rowsError }, { data: seoRows, error: seoError }] =
      await Promise.all([
        this.#client
          .from("route_section_instances")
          .select(
            "id, parent_instance_id, parent_slot, ordinal, section_key, route_section_content(locale, fields)",
          )
          .eq("bundle_id", bundleId),
        this.#client
          .from("route_seo")
          .select("locale, title, description, canonical, og_image, keywords, robots")
          .eq("bundle_id", bundleId),
      ]);
    if (rowsError) throw mapRouteCompositionError(rowsError);
    if (seoError) throw mapRouteCompositionError(seoError);

    const flat: FlatSectionRow[] = ((rows ?? []) as InstanceRow[]).map((row) => ({
      instanceId: row.id,
      parentInstanceId: row.parent_instance_id,
      parentSlot: row.parent_slot,
      ordinal: row.ordinal,
      sectionKey: row.section_key,
      content: Object.fromEntries(
        (row.route_section_content ?? []).map((entry) => [entry.locale, entry.fields]),
      ),
    }));

    const seo: Record<string, RouteSeo> = {};
    for (const row of (seoRows ?? []) as RouteSeoRow[]) {
      seo[row.locale] = rowToRouteSeo(row);
    }

    return {
      id: header.id,
      name: header.name,
      path: routeMeta.path,
      pathSegment: routeMeta.path_segment,
      parentId: routeMeta.parent_bundle_id ?? null,
      params: toParamSpecs(routeMeta.param_meta),
      published: routeMeta.published,
      version: header.version,
      updatedAt: header.updated_at,
      tree: assembleSectionTree(flat),
      seo,
    };
  }
}
