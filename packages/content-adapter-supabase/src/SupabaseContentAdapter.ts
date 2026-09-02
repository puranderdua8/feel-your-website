import {
  assembleSectionTree,
  ContentAdapterError,
  type Content,
  type ContentAdapter,
  type FlatSectionRow,
  type JsonValue,
  type ListContentQuery,
  type Locale,
  type Page,
  type RouteBundle,
  type RouteSeo,
} from "@feel-your-website/content-core";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mapContentError } from "./mapContentError.js";
import { type RouteSeoRow, rowToRouteSeo } from "./routeSeo.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface SupabaseContentAdapterOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. Every table this adapter reads is public-read RLS — see `supabase/migrations`. */
  anonKey: string;
  /**
   * Locale served when the requested one has no translation. Passed in
   * rather than read from a table: it is app configuration
   * (`apps/shell/src/i18n/config.ts`), the same value the memory adapter
   * takes in its seed, not CMS-authored content.
   */
  defaultLocale: Locale;
  /** Test seam: makes every call reject, mirroring `MemoryContentAdapter`. */
  failWith?: ContentAdapterError;
}

interface ContentItemRow {
  template_key: string;
  variant: string;
  locale: string;
  fields: Record<string, JsonValue>;
  updated_at: string;
}

/**
 * `ContentAdapter` backed by Supabase Postgres, reading tables and the
 * `published_route_manifest` view the `supabase/migrations` define.
 *
 * Every query here runs with the `anon` key: nothing this adapter reads is
 * permission-gated (see `..._content.sql`), so there is no session to carry.
 * Writing content is `apps/cms`'s concern — `ContentAdapter` itself has no
 * write methods at all; see `SupabaseContentWriter` in this same package for
 * the session-authenticated counterpart that does.
 */
export class SupabaseContentAdapter implements ContentAdapter {
  readonly #client: SupabaseClient;
  readonly #defaultLocale: Locale;
  readonly #failWith?: ContentAdapterError;

  constructor(options: SupabaseContentAdapterOptions) {
    // This adapter never signs in and never reads a session — every table it
    // queries is public-read RLS (see the class doc) — so the auth module's
    // own session persistence is disabled rather than left at its browser-
    // oriented default. Beyond being correct for a server-only, no-session
    // client, leaving it on means every fresh instance (the contract suite
    // makes one per test) registers under the same default storage key and
    // logs GoTrue's "multiple clients" warning for work this adapter never does.
    this.#client = createClient(options.url, options.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        // `persistSession: false` stops this client from ever reading or
        // writing storage, but the GoTrue client still registers under a
        // storage key at construction time, and warns if two instances share
        // one — which every default-configured client does. A random key
        // sidesteps a warning about a collision that, with persistence
        // already off, can never actually happen.
        storageKey: `feel-your-website-content-${randomUUID()}`,
      },
    });
    this.#defaultLocale = options.defaultLocale;
    this.#failWith = options.failWith;
  }

  async getContent(templateKey: string, locale: Locale, variant = ""): Promise<Content | null> {
    this.#guard();

    const locales = locale === this.#defaultLocale ? [locale] : [locale, this.#defaultLocale];
    const { data, error } = await this.#client
      .from("content_items")
      .select("template_key, variant, locale, fields, updated_at")
      .eq("template_key", templateKey)
      // Exact match — locale falls back below, variant never does.
      .eq("variant", variant)
      .in("locale", locales);

    if (error) throw mapContentError(error);

    const row = this.#preferLocale(data ?? [], locale);
    if (!row) return null;

    return this.#toContent(row, locale);
  }

  async listContent(query: ListContentQuery): Promise<Page<Content>> {
    this.#guard();

    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const startIndex = this.#decodeCursor(query.cursor ?? null);

    const locales =
      query.locale === this.#defaultLocale ? [query.locale] : [query.locale, this.#defaultLocale];
    let builder = this.#client
      .from("content_items")
      .select("template_key, variant, locale, fields, updated_at")
      // Omitting `variant` lists the default (`""`) rows.
      .eq("variant", query.variant ?? "")
      .in("locale", locales);
    if (query.templateKeys) builder = builder.in("template_key", [...query.templateKeys]);

    const { data, error } = await builder;
    if (error) throw mapContentError(error);

    // One row per template key, per locale, over the wire — a fallback
    // choice per key happens here rather than in SQL. Small by construction
    // (this platform's content volume is pages/templates, not a firehose),
    // so one round trip client-side beats a bespoke SQL function for the
    // same "prefer requested, fall back to default" rule `getContent` already
    // expresses in plain TypeScript.
    const byKey = new Map<string, ContentItemRow>();
    for (const row of (data ?? []) as ContentItemRow[]) {
      const existing = byKey.get(row.template_key);
      if (!existing || (row.locale === query.locale && existing.locale !== query.locale)) {
        byKey.set(row.template_key, row);
      }
    }

    const sortedKeys = [...byKey.keys()].sort();
    if (startIndex > sortedKeys.length) {
      throw new ContentAdapterError("invalid_request", "Pagination cursor is out of range.");
    }

    const pageKeys = sortedKeys.slice(startIndex, startIndex + limit);
    const items = pageKeys.map((key) => this.#toContent(byKey.get(key)!, query.locale));

    const nextIndex = startIndex + items.length;
    return {
      items,
      nextCursor: nextIndex < sortedKeys.length ? this.#encodeCursor(nextIndex) : null,
    };
  }

  async getRouteManifest(locale: Locale): Promise<readonly RouteBundle[]> {
    this.#guard();
    // Route bundles are not locale-scoped — matches MemoryContentAdapter and
    // the `RouteBundle` type itself, which carries no locale field. Routing
    // structure is shared across locales; only content within it translates.
    void locale;

    // Flat instance rows, one per section of every published route, plus the
    // per-locale SEO rows (a separate view — SEO is per-bundle, not
    // per-instance). Two reads in parallel; the tree is assembled here in
    // TypeScript via the shared helper, same as the memory adapter.
    const [{ data, error }, { data: seoData, error: seoError }] = await Promise.all([
      this.#client
        .from("published_route_sections")
        .select(
          "bundle_id, path, version, updated_at, instance_id, parent_instance_id, parent_slot, ordinal, section_key, section_variant, content",
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
        sectionVariant: (row.section_variant as string | null) ?? "",
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

  #preferLocale(rows: ContentItemRow[], locale: Locale): ContentItemRow | undefined {
    return (
      rows.find((row) => row.locale === locale) ??
      rows.find((row) => row.locale === this.#defaultLocale)
    );
  }

  #toContent(row: ContentItemRow, requestedLocale: Locale): Content {
    return {
      templateKey: row.template_key,
      variant: row.variant,
      locale: row.locale,
      translated: row.locale === requestedLocale,
      fields: row.fields,
      updatedAt: row.updated_at,
    };
  }

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }

  #encodeCursor(index: number): string {
    return `idx:${index}`;
  }

  #decodeCursor(cursor: string | null): number {
    if (cursor === null) return 0;

    const match = /^idx:(\d+)$/.exec(cursor);
    if (!match) throw new ContentAdapterError("invalid_request", "Malformed pagination cursor.");

    return Number(match[1]);
  }
}
