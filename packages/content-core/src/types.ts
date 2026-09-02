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
 * One instance in a route's composition tree.
 *
 * A tree of *values*, not a graph of shared references: a node owns its own
 * `slots` and its own `content`, so there is no back-edge and no structural
 * cycle risk. Two nodes may carry the same `sectionKey` — that is the same
 * *component* used twice, each with its own content, not a cycle.
 */
export interface RouteSectionNode {
  /**
   * Stable id — the React key, and the write target a slot override splices
   * into. Client-minted (a uuid) so a whole tree can be persisted in one
   * pre-order pass without round-tripping generated ids.
   */
  readonly instanceId: string;
  /** Which catalog section this instance renders. */
  readonly sectionKey: string;
  /**
   * This instance's content, per site locale: `locale -> field bag`.
   *
   * The route owns it. A section is a container — it renders whatever its
   * route hands it — so the same section placed on two routes, or twice on
   * one route, has two independent `content` bags and there is no shared or
   * "global" content behind them. A locale absent here has no content for
   * this instance in that locale; `renderComposition` renders the section's
   * placeholder rather than falling back to another locale.
   */
  readonly content: Readonly<Record<Locale, Readonly<Record<string, JsonValue>>>>;
  /**
   * Children filling this node's slots, keyed by `SectionSlotSpec.name`. A
   * slot key absent here (or mapped to `[]`) renders nothing for that slot.
   */
  readonly slots: Readonly<Record<string, readonly RouteSectionNode[]>>;
}

/**
 * A route's search-engine and social metadata, for one locale. Every field is
 * optional — a route may set only a title, or nothing at all. The shell turns
 * this into `<head>` tags; the CMS authors it per locale alongside the tree.
 */
export interface RouteSeo {
  /** `<title>` and `og:title`. */
  readonly title?: string;
  /** `<meta name="description">` and `og:description`. */
  readonly description?: string;
  /** Absolute canonical URL for this route in this locale — `<link rel="canonical">`. */
  readonly canonical?: string;
  /** `og:image` URL. */
  readonly ogImage?: string;
  /** `<meta name="keywords">`, comma-joined by the shell. */
  readonly keywords?: readonly string[];
  /** `<meta name="robots">`, e.g. `"index, follow"` or `"noindex"`. */
  readonly robots?: string;
}

/** A route's composition: the section-instance tree that renders at a path. */
export interface RouteBundle {
  id: string;
  /** The route path this bundle renders at, e.g. `/help`. */
  path: string;
  /**
   * Root section instances in render order. Each owns its own slot fills —
   * this is the shape the shell renders and the CMS route editor edits.
   */
  tree: readonly RouteSectionNode[];
  /**
   * SEO metadata per locale: `locale -> RouteSeo`. `{}` when the route has
   * none; a locale absent here has no metadata (no fallback to another).
   */
  seo: Readonly<Record<Locale, RouteSeo>>;
  version: number;
  updatedAt: string;
}
