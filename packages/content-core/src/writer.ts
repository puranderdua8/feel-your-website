import type { Locale } from "./types.js";

/**
 * The write half of content, deliberately kept out of `ContentAdapter`.
 *
 * `ContentAdapter` is what every reading surface (`apps/shell`'s BFF, a future
 * storefront, anything that only ever displays content) depends on, and giving
 * it write methods would mean every read-only consumer carries an interface it
 * can never use. `ContentWriter` is the separate, narrower thing `apps/cms`
 * depends on instead.
 *
 * Its whole surface is UI-chrome messages now: route content is written
 * through `RouteCompositionWriter` (it lives on the route), and there is no
 * other CMS-authored content type. No optimistic concurrency — a message is a
 * single string, not a versioned bundle.
 */
export interface ContentWriter {
  /** Creates or replaces one UI-chrome message. */
  saveMessage(locale: Locale, key: string, value: string): Promise<void>;

  /** Removes one UI-chrome message. Idempotent: deleting an absent row is not an error. */
  deleteMessage(locale: Locale, key: string): Promise<void>;
}
