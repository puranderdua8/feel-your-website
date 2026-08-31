import {
  ContentAdapterError,
  type Content,
  type ContentAdapter,
  type ListContentQuery,
  type Locale,
  type JsonValue,
  type Page,
  type RouteBundle,
} from "@feel-your-website/content-core";

/**
 * An in-memory ContentAdapter backed by fixtures.
 *
 * This is not a toy: it is the adapter `apps/shell` runs against for local
 * development, Storybook and tests, and it is the first implementation to
 * pass the shared contract suite. Building it before any real backend is
 * deliberate — a contract derived from a real implementation only describes
 * that implementation, and the seam it is meant to protect never gets tested.
 */

export interface MemoryContentSeed {
  /** `templateKey -> locale -> fields` */
  content: Record<string, Record<Locale, Record<string, JsonValue>>>;
  /** `locale -> messages` */
  messages?: Record<Locale, Record<string, string>>;
  routes?: readonly RouteBundle[];
  /** Locale served when the requested one has no translation. */
  defaultLocale?: Locale;
  /** Timestamp stamped on every item, so output is deterministic. */
  updatedAt?: string;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface MemoryContentAdapterOptions {
  /**
   * Makes every method reject, to exercise the contract's failure shape.
   * The real adapters get this behaviour from an unreachable backend.
   */
  failWith?: ContentAdapterError;
}

export class MemoryContentAdapter implements ContentAdapter {
  readonly #seed: Required<Pick<MemoryContentSeed, "content" | "defaultLocale" | "updatedAt">> &
    MemoryContentSeed;
  readonly #failWith?: ContentAdapterError;

  constructor(seed: MemoryContentSeed, options: MemoryContentAdapterOptions = {}) {
    this.#seed = {
      defaultLocale: "en",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...seed,
    };
    this.#failWith = options.failWith;
  }

  async getContent(templateKey: string, locale: Locale): Promise<Content | null> {
    this.#guard();

    const byLocale = this.#seed.content[templateKey];
    // A missing template is an expected outcome, not a failure.
    if (!byLocale) return null;

    const requested = byLocale[locale];
    if (requested) {
      return this.#toContent(templateKey, locale, requested, true);
    }

    const fallback = byLocale[this.#seed.defaultLocale];
    if (!fallback) return null;

    // Served, but flagged: the caller must be able to tell it did not get the
    // locale it asked for.
    return this.#toContent(templateKey, this.#seed.defaultLocale, fallback, false);
  }

  async listContent(query: ListContentQuery): Promise<Page<Content>> {
    this.#guard();

    const keys = Object.keys(this.#seed.content)
      .filter((key) => !query.templateKeys || query.templateKeys.includes(key))
      // Sorted so cursors stay stable across calls — an unstable order is how
      // cursor pagination silently skips or repeats rows.
      .sort();

    const start = this.#decodeCursor(query.cursor ?? null, keys);
    // Clamp rather than reject: backends differ in their maxima, and the same
    // query must not succeed on one adapter and fail on another.
    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    const items: Content[] = [];
    let index = start;

    while (index < keys.length && items.length < limit) {
      const key = keys[index] as string;
      const content = await this.getContent(key, query.locale);
      if (content) items.push(content);
      index += 1;
    }

    return {
      items,
      nextCursor: index < keys.length ? this.#encodeCursor(index) : null,
    };
  }

  async getRouteManifest(locale: Locale): Promise<readonly RouteBundle[]> {
    this.#guard();
    void locale;
    return this.#seed.routes ?? [];
  }

  async getMessages(locale: Locale): Promise<Readonly<Record<string, string>>> {
    this.#guard();
    // An unknown locale yields an empty map, never null: the app falls back to
    // its bootstrap bundle, and a null would force a guard at every call site.
    return this.#seed.messages?.[locale] ?? {};
  }

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }

  #toContent(
    templateKey: string,
    locale: Locale,
    fields: Record<string, JsonValue>,
    translated: boolean,
  ): Content {
    return {
      templateKey,
      locale,
      translated,
      fields,
      updatedAt: this.#seed.updatedAt,
    };
  }

  #encodeCursor(index: number): string {
    return `idx:${index}`;
  }

  #decodeCursor(cursor: string | null, keys: readonly string[]): number {
    if (cursor === null) return 0;

    const match = /^idx:(\d+)$/.exec(cursor);
    if (!match) {
      throw new ContentAdapterError("invalid_request", "Malformed pagination cursor.");
    }

    const index = Number(match[1]);
    if (index > keys.length) {
      throw new ContentAdapterError("invalid_request", "Pagination cursor is out of range.");
    }
    return index;
  }
}
