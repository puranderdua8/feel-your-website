import {
  assembleSectionTree,
  type ContentAdapter,
  type ContentAdapterError,
  type FlatSectionRow,
  type JsonValue,
  type Locale,
  type RouteBundle,
  type RouteSeo,
} from "@feel-your-website/content-core";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mapContentError } from "./mapContentError.js";
import { type RouteSeoRow, rowToRouteSeo } from "./routeSeo.js";

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
      this.#client
        .from("published_route_sections")
        .select(
          "bundle_id, path, version, updated_at, instance_id, parent_instance_id, parent_slot, ordinal, section_key, content",
        ),
      this.#client
        .from("published_route_seo")
        .select("bundle_id, locale, title, description, canonical, og_image, keywords, robots"),
    ]);
    if (error) throw mapContentError(error);
    if (seoError) throw mapContentError(seoError);

    const seoByBundle = new Map<string, Record<string, RouteSeo>>();
    for (const row of (seoData ?? []) as (RouteSeoRow & { bundle_id: string })[]) {
      const forBundle = seoByBundle.get(row.bundle_id) ?? {};
      forBundle[row.locale] = rowToRouteSeo(row);
      seoByBundle.set(row.bundle_id, forBundle);
    }

    const byBundle = new Map<
      string,
      { path: string; version: number; updatedAt: string; rows: FlatSectionRow[] }
    >();

    for (const row of data ?? []) {
      const bundleId = row.bundle_id as string;
      let entry = byBundle.get(bundleId);
      if (!entry) {
        entry = {
          path: row.path as string,
          version: row.version as number,
          updatedAt: row.updated_at as string,
          rows: [],
        };
        byBundle.set(bundleId, entry);
      }
      entry.rows.push({
        instanceId: row.instance_id as string,
        parentInstanceId: (row.parent_instance_id as string | null) ?? null,
        parentSlot: (row.parent_slot as string | null) ?? null,
        ordinal: row.ordinal as number,
        sectionKey: row.section_key as string,
        // The view aggregates route_section_content into a `locale -> fields`
        // object; `{}` when the instance has no content rows yet.
        content:
          (row.content as Record<string, Record<string, JsonValue>> | null | undefined) ?? {},
      });
    }

    return [...byBundle.entries()].map(([id, entry]) => ({
      id,
      path: entry.path,
      tree: assembleSectionTree(entry.rows),
      seo: seoByBundle.get(id) ?? {},
      version: entry.version,
      updatedAt: entry.updatedAt,
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

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }
}
