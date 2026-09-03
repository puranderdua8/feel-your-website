import {
  assembleSectionTree,
  paramMetaToRecord,
  parseRoutePattern,
  splitSegment,
  type ContentAdapter,
  type ContentAdapterError,
  type FlatSectionRow,
  type JsonValue,
  type Locale,
  type RouteBundle,
  type RouteHeader,
  type RouteParamMeta,
  type RouteSeo,
} from "@feel-your-website/content-core";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mapContentError } from "./mapContentError.js";
import { type RouteSeoRow, rowToRouteSeo } from "./routeSeo.js";

/** One `published_route_sections` row; the last two are absent on a pre-migration DB. */
interface SectionRow {
  bundle_id: string;
  path: string;
  version: number;
  updated_at: string;
  instance_id: string;
  parent_instance_id: string | null;
  parent_slot: string | null;
  ordinal: number;
  section_key: string;
  content: unknown;
  parent_bundle_id?: string | null;
  param_meta?: unknown;
}

export interface SupabaseContentAdapterOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. Every table this adapter reads is public-read RLS — see `supabase/migrations`. */
  anonKey: string;
  /** Test seam: makes every call reject, mirroring `MemoryContentAdapter`. */
  failWith?: ContentAdapterError;
}

/**
 * `ContentAdapter` backed by Supabase Postgres, reading the
 * `published_route_sections` / `published_route_seo` views and
 * `content_messages` the `supabase/migrations` define.
 *
 * Every query here runs with the `anon` key: nothing this adapter reads is
 * permission-gated, so there is no session to carry. Writing is `apps/cms`'s
 * concern — `ContentAdapter` has no write methods; see `SupabaseContentWriter`
 * for the session-authenticated message writer.
 */
export class SupabaseContentAdapter implements ContentAdapter {
  readonly #client: SupabaseClient;
  readonly #failWith?: ContentAdapterError;

  constructor(options: SupabaseContentAdapterOptions) {
    // This adapter never signs in and never reads a session — every table it
    // queries is public-read RLS — so session persistence is disabled rather
    // than left at its browser-oriented default. A random storage key
    // sidesteps GoTrue's "multiple clients" warning for a collision that,
    // with persistence off, can never actually happen (the contract suite
    // builds one instance per test).
    this.#client = createClient(options.url, options.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: `feel-your-website-content-${randomUUID()}`,
      },
    });
    this.#failWith = options.failWith;
  }

  async getRouteManifest(locale: Locale): Promise<readonly RouteBundle[]> {
    this.#guard();
    // Route bundles are not locale-scoped — matches MemoryContentAdapter and
    // the `RouteBundle` type itself. Routing structure is shared across
    // locales; each node ships content for every locale.
    void locale;

    // Flat instance rows, one per section of every published route, plus the
    // per-locale SEO rows (a separate view — SEO is per-bundle, not
    // per-instance). Two reads in parallel; the tree is assembled here in
    // TypeScript via the shared helper, same as the memory adapter.
    const [{ data, error }, { data: seoData, error: seoError }] = await Promise.all([
      this.#selectSections(),
      this.#client
        .from("published_route_seo")
        .select("bundle_id, locale, title, description, canonical, og_image, keywords, robots"),
    ]);
    if (error) throw mapContentError(error);
    if (seoError) throw mapContentError(seoError);

    const sectionRows = (data ?? []) as SectionRow[];

    const seoByBundle = new Map<string, Record<string, RouteSeo>>();
    for (const row of (seoData ?? []) as (RouteSeoRow & { bundle_id: string })[]) {
      const forBundle = seoByBundle.get(row.bundle_id) ?? {};
      forBundle[row.locale] = rowToRouteSeo(row);
      seoByBundle.set(row.bundle_id, forBundle);
    }

    const byBundle = new Map<
      string,
      {
        path: string;
        parentId: string | null;
        paramMeta: Readonly<Record<string, RouteParamMeta>>;
        version: number;
        updatedAt: string;
        rows: FlatSectionRow[];
      }
    >();

    for (const row of sectionRows) {
      let entry = byBundle.get(row.bundle_id);
      if (!entry) {
        entry = {
          path: row.path,
          parentId: row.parent_bundle_id ?? null,
          paramMeta: paramMetaToRecord(row.param_meta),
          version: row.version,
          updatedAt: row.updated_at,
          rows: [],
        };
        byBundle.set(row.bundle_id, entry);
      }
      entry.rows.push({
        instanceId: row.instance_id,
        parentInstanceId: row.parent_instance_id ?? null,
        parentSlot: row.parent_slot ?? null,
        ordinal: row.ordinal,
        sectionKey: row.section_key,
        // The view aggregates route_section_content into a `locale -> fields`
        // object; `{}` when the instance has no content rows yet.
        content: (row.content as Record<string, Record<string, JsonValue>> | null) ?? {},
      });
    }

    const pathById = new Map([...byBundle.entries()].map(([id, entry]) => [id, entry.path]));

    return [...byBundle.entries()].map(([id, entry]) => ({
      id,
      path: entry.path,
      // Derived from the parent's absolute pattern; a route with no parent
      // contributes its whole path.
      pathSegment: segmentOf(entry.path, entry.parentId, pathById),
      parentId: entry.parentId,
      paramNames: safeParamNames(entry.path),
      paramMeta: entry.paramMeta,
      tree: assembleSectionTree(entry.rows),
      seo: seoByBundle.get(id) ?? {},
      version: entry.version,
      updatedAt: entry.updatedAt,
    }));
  }

  async getRouteHeaders(): Promise<readonly RouteHeader[]> {
    this.#guard();

    const { data, error } = await this.#client
      .from("published_route_headers")
      .select("bundle_id, path, path_segment, parent_bundle_id, param_meta, title");
    if (error) throw mapContentError(error);

    return (data ?? []).map((row) => ({
      id: row.bundle_id as string,
      pathSegment: row.path_segment as string,
      path: row.path as string,
      parentId: (row.parent_bundle_id as string | null | undefined) ?? null,
      hasParams: (row.path as string).includes(":"),
      title: (row.title as Record<string, string | undefined> | null) ?? {},
    }));
  }

  async getMessages(locale: Locale): Promise<Readonly<Record<string, string>>> {
    this.#guard();

    const { data, error } = await this.#client
      .from("content_messages")
      .select("key, value")
      .eq("locale", locale);
    if (error) throw mapContentError(error);

    const messages: Record<string, string> = {};
    for (const row of data ?? []) messages[row.key as string] = row.value as string;
    return messages;
  }

  /**
   * Reads `published_route_sections`, tolerating a database that is a migration
   * behind: `20260911000100` appends `parent_bundle_id` / `param_meta`, so if
   * the code deploys before the migration runs, the full select 404s on the
   * missing column. Rather than 500 every shell page, retry with the stable
   * column set and degrade to flat routing (logged once).
   */
  async #selectSections() {
    this.#guard();
    const base =
      "bundle_id, path, version, updated_at, instance_id, parent_instance_id, parent_slot, ordinal, section_key, content";

    const full = await this.#client
      .from("published_route_sections")
      .select(`${base}, parent_bundle_id, param_meta`);
    if (!full.error || full.error.code !== "42703") return full;

    if (!this.#warnedNoHierarchy) {
      this.#warnedNoHierarchy = true;
      console.warn(
        "[content-adapter-supabase] migration 20260911000100 not applied — route nesting inert until it is",
      );
    }
    return this.#client.from("published_route_sections").select(base);
  }

  #warnedNoHierarchy = false;

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }
}

/** Path pattern -> param names, tolerating a legacy literal path. */
function safeParamNames(path: string): readonly string[] {
  try {
    return parseRoutePattern(path).paramNames;
  } catch {
    return [];
  }
}

/** A route's own segment: the whole path when top-level, else `path` minus the parent's. */
function segmentOf(
  path: string,
  parentId: string | null,
  pathById: ReadonlyMap<string, string>,
): string {
  if (!parentId) return path;
  const parentPath = pathById.get(parentId);
  if (!parentPath) return path;
  try {
    return splitSegment(path, parentPath);
  } catch {
    return path;
  }
}
