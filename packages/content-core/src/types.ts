/**
 * The platform's own content model.
 *
 * These types exist so that no vendor's shapes reach the apps. Supabase rows,
 * PostgREST envelopes, Strapi's `documentId`/`attributes` wrappers and
 * Sanity's portable text all stop at the adapter boundary and are mapped into
 * the types below. That mapping is the entire cost of keeping the CMS
 * replaceable, and it is paid once per adapter rather than once per screen.
 */

/**
 * Any value a CMS can actually store and a BFF can actually send.
 *
 * `unknown` was the first instinct for a template-shaped payload, but it is
 * both less accurate and unusable: content crosses a network boundary as
 * JSON, so `unknown` is a claim the type system cannot honour, and TanStack
 * Start rightly refuses to serialise it.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A BCP-47 language tag, e.g. `en`, `hi`, `en-IN`. */
export type Locale = string;

/**
 * A template key names a component the UI kit exports and the CMS may target.
 * Like permissions, the vocabulary is code-defined and closed within a
 * project: the CMS can compose known templates, not invent new ones.
 */
export interface TemplateKeyDefinition {
  readonly name: string;
  /** Shown in the CMS composer so an author knows what they are placing. */
  readonly description: string;
}

export interface TemplateKeyCatalog<TKey extends string> {
  readonly definitions: readonly TemplateKeyDefinition[];
  readonly values: readonly TKey[];
  readonly includes: (value: string) => value is TKey;
}

/**
 * A resolved piece of content for one template key in one locale.
 */
export interface Content<TKey extends string = string> {
  templateKey: TKey;
  /** The locale actually served, which may differ from the one requested. */
  locale: Locale;
  /**
   * `false` when the requested locale had no translation and a fallback was
   * served instead.
   *
   * Surfaced rather than hidden so the app can decide: fall back silently for
   * body copy, but never silently for something read aloud to a customer.
   */
  translated: boolean;
  /** Template-shaped payload. Validated by the app against the template. */
  fields: Readonly<Record<string, JsonValue>>;
  updatedAt: string;
}

/** A route's composition: which templates render, in what order. */
export interface RouteBundle<TKey extends string = string> {
  id: string;
  /** The route path this bundle renders at, e.g. `/help`. */
  path: string;
  /** Template keys in render order. Validated against the catalog at publish. */
  items: readonly TKey[];
  version: number;
  updatedAt: string;
}

/** One page of results, with an opaque cursor. */
export interface Page<TItem> {
  items: readonly TItem[];
  /**
   * Cursor for the next page, or `null` at the end.
   *
   * Deliberately opaque and cursor-based rather than offset-based: offsets
   * skip or repeat rows when content is published mid-listing, and every
   * adapter must behave the same way here.
   */
  nextCursor: string | null;
}

export interface ListContentQuery {
  locale: Locale;
  /** Restrict to these template keys. Omitted means all. */
  templateKeys?: readonly string[];
  /** Page size. Adapters must clamp to their own maximum rather than error. */
  limit?: number;
  cursor?: string | null;
}
