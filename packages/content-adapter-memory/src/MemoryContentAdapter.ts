import {
  ContentAdapterError,
  flattenTree,
  RouteCompositionConflictError,
  RouteCompositionError,
  type Content,
  type ContentAdapter,
  type ContentWriter,
  type ListContentQuery,
  type Locale,
  type JsonValue,
  type Page,
  type RouteBundle,
  type RouteComposition,
  type RouteCompositionInput,
  type RouteCompositionReader,
  type RouteCompositionSummary,
  type RouteCompositionWriter,
} from "@feel-your-website/content-core";
import { randomUUID } from "node:crypto";

/**
 * An in-memory ContentAdapter backed by fixtures.
 *
 * This is not a toy: it is the adapter `apps/shell` runs against for local
 * development, Storybook and tests, and it is the first implementation to
 * pass the shared contract suite. Building it before any real backend is
 * deliberate — a contract derived from a real implementation only describes
 * that implementation, and the seam it is meant to protect never gets tested.
 */

/**
 * A seed route: `tree` is required, the deprecated `items` optional. `name`
 * and `published` mirror the config-bundle header — a seed that omits them
 * gets `name = path` and `published = true` (a fixture route is live by
 * default).
 */
export type RouteSeed = Omit<RouteBundle, "items"> & {
  items?: readonly string[];
  name?: string;
  published?: boolean;
};

export interface MemoryContentSeed {
  /** Default-variant content: `templateKey -> locale -> fields` */
  content: Record<string, Record<Locale, Record<string, JsonValue>>>;
  /**
   * Named non-default content variants:
   * `templateKey -> variant -> locale -> fields`. Additive — the default
   * variant (`""`) always lives in `content`, never here.
   */
  variants?: Record<string, Record<string, Record<Locale, Record<string, JsonValue>>>>;
  /** `locale -> messages` */
  messages?: Record<Locale, Record<string, string>>;
  /**
   * Published route bundles, tree-first. `items` is optional here — when
   * omitted `getRouteManifest` derives it from `tree` via `flattenTree`, so a
   * seed never has to keep the deprecated flat list in sync by hand.
   *
   * Not `readonly`: `saveComposition` mutates this array in place, the same
   * way `saveContentItem` mutates `content` — one class over one mutable seed.
   */
  routes?: RouteSeed[];
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

export class MemoryContentAdapter
  implements ContentAdapter, ContentWriter, RouteCompositionWriter, RouteCompositionReader
{
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

  async getContent(templateKey: string, locale: Locale, variant = ""): Promise<Content | null> {
    this.#guard();

    const byLocale = this.#localesFor(templateKey, variant);
    // A missing template — or a missing variant of it — is an expected
    // outcome, not a failure. No fallback between variants.
    if (!byLocale) return null;

    const requested = byLocale[locale];
    if (requested) {
      return this.#toContent(templateKey, variant, locale, requested, true);
    }

    const fallback = byLocale[this.#seed.defaultLocale];
    if (!fallback) return null;

    // Served, but flagged: the caller must be able to tell it did not get the
    // locale it asked for.
    return this.#toContent(templateKey, variant, this.#seed.defaultLocale, fallback, false);
  }

  /** The `locale -> fields` map for one (templateKey, variant), or undefined. */
  #localesFor(
    templateKey: string,
    variant: string,
  ): Record<Locale, Record<string, JsonValue>> | undefined {
    return variant === ""
      ? this.#seed.content[templateKey]
      : this.#seed.variants?.[templateKey]?.[variant];
  }

  async listContent(query: ListContentQuery): Promise<Page<Content>> {
    this.#guard();

    // Omitting `variant` lists the default (`""`) rows, from `content`; a
    // named variant lists the keys that have that variant, from `variants`.
    const variant = query.variant ?? "";
    const source =
      variant === ""
        ? Object.keys(this.#seed.content)
        : Object.keys(this.#seed.variants ?? {}).filter(
            (key) => this.#seed.variants?.[key]?.[variant],
          );

    const keys = source
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
      const content = await this.getContent(key, query.locale, variant);
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
    // Only published routes — a seed route with no `published` flag is a
    // fixture and counts as live; `saveComposition` can now create drafts.
    return (this.#seed.routes ?? [])
      .filter((route) => route.published !== false)
      .map((route) => ({
        id: route.id,
        path: route.path,
        tree: route.tree,
        items: route.items ?? flattenTree(route.tree).map((ref) => ref.key),
        version: route.version,
        updatedAt: route.updatedAt,
      }));
  }

  async listCompositions(): Promise<readonly RouteCompositionSummary[]> {
    this.#guard();
    return (this.#seed.routes ?? []).map((route) => ({
      id: route.id,
      name: route.name ?? route.path,
      path: route.path,
      published: route.published ?? true,
      version: route.version,
      updatedAt: route.updatedAt,
    }));
  }

  async getComposition(bundleId: string): Promise<RouteComposition | null> {
    this.#guard();
    const route = (this.#seed.routes ?? []).find((candidate) => candidate.id === bundleId);
    if (!route) return null;
    return {
      id: route.id,
      name: route.name ?? route.path,
      path: route.path,
      published: route.published ?? true,
      version: route.version,
      tree: route.tree,
      updatedAt: route.updatedAt,
    };
  }

  async getMessages(locale: Locale): Promise<Readonly<Record<string, string>>> {
    this.#guard();
    // An unknown locale yields an empty map, never null: the app falls back to
    // its bootstrap bundle, and a null would force a guard at every call site.
    return this.#seed.messages?.[locale] ?? {};
  }

  // RouteCompositionWriter — the write counterpart to `getRouteManifest`, on
  // this same class for the same reason `ContentWriter` is: both sides share
  // the one mutable `#seed`, so a save is visible to the next read in local
  // dev with no backend.

  async saveComposition(
    bundleId: string | null,
    input: RouteCompositionInput,
    expectedVersion: number | null,
    actor: string,
  ): Promise<RouteBundle> {
    this.#guard();
    void actor; // the seam accepts it for parity; a real backend uses the session.

    this.#seed.routes ??= [];
    const routes = this.#seed.routes;
    const now = new Date().toISOString();
    const items = flattenTree(input.tree).map((ref) => ref.key);

    if (bundleId === null) {
      const created: RouteSeed = {
        id: randomUUID(),
        name: input.name,
        path: input.path,
        published: input.published,
        tree: input.tree,
        version: 1,
        updatedAt: now,
      };
      routes.push(created);
      return {
        id: created.id,
        path: created.path,
        tree: created.tree,
        items,
        version: 1,
        updatedAt: now,
      };
    }

    const index = routes.findIndex((route) => route.id === bundleId);
    if (index === -1) {
      throw new RouteCompositionError("not_found", `No route bundle ${bundleId}.`);
    }

    const current = routes[index]!;
    if (expectedVersion !== null && current.version !== expectedVersion) {
      throw new RouteCompositionConflictError(expectedVersion, current.version);
    }

    const updated: RouteSeed = {
      ...current,
      name: input.name,
      path: input.path,
      published: input.published,
      tree: input.tree,
      version: current.version + 1,
      updatedAt: now,
    };
    routes[index] = updated;
    return {
      id: updated.id,
      path: updated.path,
      tree: updated.tree,
      items,
      version: updated.version,
      updatedAt: now,
    };
  }

  // ContentWriter — see that interface's own doc for why this is not part of
  // ContentAdapter. Implemented on the same class rather than a separate
  // `MemoryContentWriter` purely because there is nothing to separate here:
  // both already share this one mutable `#seed`, unlike the Supabase pair,
  // where reads run anon and writes run as a permission-checked session —
  // two genuinely different concerns split into two classes.

  async saveContentItem(
    templateKey: string,
    locale: Locale,
    fields: Readonly<Record<string, JsonValue>>,
    variant = "",
  ): Promise<Content> {
    this.#guard();

    if (variant === "") {
      this.#seed.content[templateKey] ??= {};
      this.#seed.content[templateKey][locale] = { ...fields };
    } else {
      this.#seed.variants ??= {};
      this.#seed.variants[templateKey] ??= {};
      this.#seed.variants[templateKey][variant] ??= {};
      this.#seed.variants[templateKey][variant][locale] = { ...fields };
    }

    return this.#toContent(templateKey, variant, locale, fields, true);
  }

  async deleteContentItem(templateKey: string, locale: Locale, variant = ""): Promise<void> {
    this.#guard();
    // Idempotent by contract: deleting what is already absent is a no-op,
    // not an error — `delete` on a missing key is simply a no-op already.
    if (variant === "") {
      delete this.#seed.content[templateKey]?.[locale];
    } else {
      delete this.#seed.variants?.[templateKey]?.[variant]?.[locale];
    }
  }

  async saveMessage(locale: Locale, key: string, value: string): Promise<void> {
    this.#guard();

    this.#seed.messages ??= {};
    this.#seed.messages[locale] ??= {};
    this.#seed.messages[locale][key] = value;
  }

  async deleteMessage(locale: Locale, key: string): Promise<void> {
    this.#guard();
    delete this.#seed.messages?.[locale]?.[key];
  }

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }

  #toContent(
    templateKey: string,
    variant: string,
    locale: Locale,
    fields: Record<string, JsonValue>,
    translated: boolean,
  ): Content {
    return {
      templateKey,
      variant,
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
