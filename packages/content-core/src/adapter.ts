import type { Content, ListContentQuery, Locale, Page, RouteBundle } from "./types.js";

/**
 * The only interface the apps depend on for content.
 *
 * `apps/shell` and `apps/cms` import this, never `supabase-js`. The concrete
 * adapter is injected once at server start from environment config, which is
 * what lets Supabase be replaced with Strapi, Sanity or a bespoke backend
 * without touching a single screen.
 *
 * Implementations must satisfy the behavioural contract in
 * `contract-tests.ts`, not merely these signatures — see the note there on
 * why signature-matching alone does not give substitutability.
 */
export interface ContentAdapter<TKey extends string = string> {
  /**
   * Resolves one template's content in one locale.
   *
   * Returns `null` when the template has no content at all — a missing
   * resource is an expected outcome, not an error, so it is not thrown.
   * Falling back to another locale sets `translated: false` rather than
   * returning null.
   */
  getContent(templateKey: TKey, locale: Locale): Promise<Content<TKey> | null>;

  /** Lists content, cursor-paginated. */
  listContent(query: ListContentQuery): Promise<Page<Content<TKey>>>;

  /**
   * The published route manifest: which templates render at which paths.
   * Only published bundles are returned; drafts never reach the shell.
   */
  getRouteManifest(locale: Locale): Promise<readonly RouteBundle<TKey>[]>;

  /**
   * UI chrome messages for a locale, as ICU MessageFormat strings.
   *
   * Content lives here rather than in compiled message bundles because this
   * platform serves *all* copy from the CMS. The app ships only a small
   * bootstrap set for what must render before this call returns.
   */
  getMessages(locale: Locale): Promise<Readonly<Record<string, string>>>;
}
