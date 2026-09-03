import type { Locale, RouteBundle } from "./types.js";

/**
 * A published route's identity and shape, without its section tree — enough to
 * build the site nav and breadcrumbs. Returned by
 * {@link ContentAdapter.getRouteHeaders}, which is deliberately cheaper than
 * {@link ContentAdapter.getRouteManifest}: the nav is resolved on the root
 * loader of every SSR navigation and must not pull every section row.
 */
export interface RouteHeader {
  readonly id: string;
  /** This route's own path contribution — see {@link RouteBundle.pathSegment}. */
  readonly pathSegment: string;
  /** The absolute path pattern — see {@link RouteBundle.path}. */
  readonly path: string;
  readonly parentId: string | null;
  /** `true` when {@link path} contains a `:name` segment (no single nav URL). */
  readonly hasParams: boolean;
  /** The route's SEO title per locale, for the nav/breadcrumb label. */
  readonly title: Readonly<Record<Locale, string | undefined>>;
}

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
   * The published routes as lightweight {@link RouteHeader}s — id, path
   * pattern, parent, and per-locale title — with no section tree. Feeds the
   * shell's auto-generated site nav and breadcrumbs. Only published bundles,
   * same as {@link getRouteManifest}.
   */
  getRouteHeaders(): Promise<readonly RouteHeader[]>;

  /**
   * UI chrome messages for a locale, as ICU MessageFormat strings.
   *
   * Content lives here rather than in compiled message bundles because this
   * platform serves *all* copy from the CMS. The app ships only a small
   * bootstrap set for what must render before this call returns.
   */
  getMessages(locale: Locale): Promise<Readonly<Record<string, string>>>;
}
