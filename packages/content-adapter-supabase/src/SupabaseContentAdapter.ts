import {
  ContentAdapterError,
  type Content,
  type ContentAdapter,
  type JsonValue,
  type ListContentQuery,
  type Locale,
  type Page,
  type RouteBundle,
} from "@feel-your-website/content-core";
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { mapContentError } from "./mapContentError.js";

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
 * Writing content is `apps/cms`'s concern (Phase 6), not this adapter's —
 * this interface has no write methods at all.
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

  async getContent(templateKey: string, locale: Locale): Promise<Content | null> {
    this.#guard();

    const locales = locale === this.#defaultLocale ? [locale] : [locale, this.#defaultLocale];
    const { data, error } = await this.#client
      .from("content_items")
      .select("template_key, locale, fields, updated_at")
      .eq("template_key", templateKey)
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
      .select("template_key, locale, fields, updated_at")
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

    const { data, error } = await this.#client
      .from("published_route_manifest")
      .select("bundle_id, path, version, updated_at, items");
    if (error) throw mapContentError(error);

    return (data ?? []).map((row) => ({
      id: row.bundle_id as string,
      path: row.path as string,
      items: row.items as readonly string[],
      version: row.version as number,
      updatedAt: row.updated_at as string,
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
