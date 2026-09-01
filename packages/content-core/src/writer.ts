import type { Content, JsonValue, Locale } from "./types.js";

/**
 * The write half of content, deliberately kept out of `ContentAdapter`.
 *
 * `ContentAdapter`'s own doc says it plainly: this contract "has no write
 * surface at all." That is still true — `ContentAdapter` is what every
 * reading surface (`apps/shell`'s BFF, a future storefront, anything that
 * only ever displays content) depends on, and giving it write methods would
 * mean every read-only consumer carries an interface it can never use.
 * `ContentWriter` is the separate, narrower thing `apps/cms` depends on
 * instead.
 *
 * No optimistic concurrency here, unlike `ConfigBundleStore` — content is a
 * single field-bag per key, not a versioned, audited bundle drawn from a
 * fixed vocabulary (see `..._content_writes.sql`'s own note on why the
 * database does an upsert here rather than a version-checked update).
 */
export interface ContentWriter<TKey extends string = string> {
  /** Creates or replaces one template's content in one locale. */
  saveContentItem(
    templateKey: TKey,
    locale: Locale,
    fields: Readonly<Record<string, JsonValue>>,
  ): Promise<Content<TKey>>;

  /** Removes one template's content in one locale. Idempotent: deleting an absent row is not an error. */
  deleteContentItem(templateKey: TKey, locale: Locale): Promise<void>;

  /** Creates or replaces one UI-chrome message. */
  saveMessage(locale: Locale, key: string, value: string): Promise<void>;

  /** Removes one UI-chrome message. Idempotent. */
  deleteMessage(locale: Locale, key: string): Promise<void>;
}
