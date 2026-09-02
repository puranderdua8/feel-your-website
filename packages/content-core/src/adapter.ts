import type { Locale, RouteBundle } from "./types.js";

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
export interface ContentAdapter {
  /**
   * The published route manifest: the section-instance tree that renders at
   * each path, every node carrying its own per-locale content
   * ({@link RouteSectionNode.content}) and every bundle its per-locale SEO.
   * Only published bundles are returned; drafts never reach the shell.
   *
   * `locale` is accepted for signature stability but not used — the tree is
   * locale-independent structure and each node ships content for every
   * locale, so the renderer, not this call, selects one.
   */
  getRouteManifest(locale: Locale): Promise<readonly RouteBundle[]>;

  /**
   * UI chrome messages for a locale, as ICU MessageFormat strings.
   *
   * Content lives here rather than in compiled message bundles because this
   * platform serves *all* copy from the CMS. The app ships only a small
   * bootstrap set for what must render before this call returns.
   */
  getMessages(locale: Locale): Promise<Readonly<Record<string, string>>>;
}
