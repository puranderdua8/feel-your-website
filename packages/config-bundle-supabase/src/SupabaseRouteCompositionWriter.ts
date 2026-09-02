import {
  flattenTree,
  type RouteBundle,
  type RouteCompositionInput,
  type RouteCompositionWriter,
} from "@feel-your-website/content-core";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapRouteCompositionError } from "./mapRouteCompositionError.js";

export interface SupabaseRouteCompositionWriterOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. `has_permission('manage:routes')`, enforced inside the RPC, is what protects the write. */
  anonKey: string;
  /**
   * Where the session lives across requests — the same contract
   * `SupabaseConfigBundleStore` takes: `save_route_composition` checks the
   * *calling session's* permission, so this needs the session, not a bare
   * anon key.
   */
  cookies: CookieAdapter;
}

/**
 * `RouteCompositionWriter` backed by Supabase — the `save_route_composition`
 * RPC `..._route_composition_writer.sql` defines.
 *
 * Lives beside `SupabaseConfigBundleStore` rather than in
 * `content-adapter-supabase` because a route composition *is* a config bundle
 * (same header, version and audit row); it just writes a recursive tree
 * instead of a flat list, which is why it is a separate narrow seam and not a
 * method on the store.
 */
export class SupabaseRouteCompositionWriter implements RouteCompositionWriter {
  readonly #client: SupabaseClient;

  constructor(options: SupabaseRouteCompositionWriterOptions) {
    this.#client = createServerClient(options.url, options.anonKey, {
      cookies: {
        getAll: async () => await options.cookies.getAll(),
        setAll: async (cookies, headers) => {
          await options.cookies.setAll(cookies, headers);
        },
      },
    });
  }

  async saveComposition(
    bundleId: string | null,
    input: RouteCompositionInput,
    expectedVersion: number | null,
    actor: string,
  ): Promise<RouteBundle> {
    void actor; // the RPC derives the writer from auth.uid(), not this string.

    const items = flattenTree(input.tree).map((ref) => ref.key);

    const { data, error } = await this.#client.rpc("save_route_composition", {
      p_id: bundleId,
      p_name: input.name,
      p_path: input.path,
      p_published: input.published,
      p_expected_version: expectedVersion,
      p_tree: input.tree,
      p_items: items,
    });
    if (error) throw mapRouteCompositionError(error, expectedVersion);

    const row = data as { id: string; version: number; updated_at: string };
    return {
      id: row.id,
      path: input.path,
      // Echoed: the RPC returns only the bundle header, and this is exactly
      // what was just written.
      tree: input.tree,
      items,
      version: row.version,
      updatedAt: row.updated_at,
    };
  }
}
