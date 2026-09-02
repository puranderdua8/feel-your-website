import {
  assembleSectionTree,
  type FlatSectionRow,
  type RouteComposition,
  type RouteCompositionReader,
  type RouteCompositionSummary,
} from "@feel-your-website/content-core";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapRouteCompositionError } from "./mapRouteCompositionError.js";

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

interface HeaderRow {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  route_bundles:
    { path: string; published: boolean } | { path: string; published: boolean }[] | null;
}

interface InstanceRow {
  id: string;
  parent_instance_id: string | null;
  parent_slot: string | null;
  ordinal: number;
  section_key: string;
  section_variant: string | null;
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
      .select("id, name, version, updated_at, route_bundles!inner(path, published)")
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
      .select("id, name, version, updated_at, route_bundles(path, published)")
      .eq("id", bundleId)
      .eq("vocabulary", "template_key")
      .maybeSingle<HeaderRow>();
    if (headerError) throw mapRouteCompositionError(headerError);
    if (!header) return null;

    const routeMeta = Array.isArray(header.route_bundles)
      ? header.route_bundles[0]
      : header.route_bundles;
    if (!routeMeta) return null;

    const { data: rows, error: rowsError } = await this.#client
      .from("route_section_instances")
      .select("id, parent_instance_id, parent_slot, ordinal, section_key, section_variant")
      .eq("bundle_id", bundleId);
    if (rowsError) throw mapRouteCompositionError(rowsError);

    const flat: FlatSectionRow[] = ((rows ?? []) as InstanceRow[]).map((row) => ({
      instanceId: row.id,
      parentInstanceId: row.parent_instance_id,
      parentSlot: row.parent_slot,
      ordinal: row.ordinal,
      sectionKey: row.section_key,
      sectionVariant: row.section_variant ?? "",
    }));

    return {
      id: header.id,
      name: header.name,
      path: routeMeta.path,
      published: routeMeta.published,
      version: header.version,
      updatedAt: header.updated_at,
      tree: assembleSectionTree(flat),
    };
  }
}
