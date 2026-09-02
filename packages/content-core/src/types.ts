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
 * "A section" as something chosen into a route — just which section. The
 * `variant` field is vestigial: content is no longer keyed by section +
 * variant, it lives on the route instance ({@link RouteSectionNode.content}),
 * so every ref the CMS mints now carries `variant: ""`. Kept on the type
 * only until the B6 cleanup drops it along with the `content_items` read path.
 *
 * The unit the CMS composes a route from.
 */
export interface SectionRef {
  readonly key: string;
  /** @deprecated Always `""`. Removed in B6 with the section-content read path. */
  readonly variant: string;
}

/**
 * One instance in a route's composition tree.
 *
 * A tree of *values*, not a graph of shared references: a node owns its own
 * `slots` and its own `content`, so there is no back-edge and no structural
 * cycle risk. Two nodes may carry the same {@link SectionRef} — that is the
 * same *component* used twice, each with its own content, not a cycle.
 */
export interface RouteSectionNode {
  /**
   * Stable id — the React key, and the write target a slot override splices
   * into. Client-minted (a uuid) so a whole tree can be persisted in one
   * pre-order pass without round-tripping generated ids.
   */
  readonly instanceId: string;
  readonly ref: SectionRef;
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
 * A resolved piece of content for one template key in one locale.
 */
export interface Content<TKey extends string = string> {
  templateKey: TKey;
  /**
   * The named content variant. `""` is the section's default/global content;
   * a named variant (`"star"`, `"short"`, …) is an independently-selectable
   * alternative the CMS can point a route's slot at. Locale fallback applies
   * within a variant; there is no fallback between variants.
   */
  variant: string;
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
  /**
   * Restrict to one content variant. Omitted lists only the default
   * variant (`""`); pass a name to list that variant's rows instead.
   */
  variant?: string;
  /** Restrict to these template keys. Omitted means all. */
  templateKeys?: readonly string[];
  /** Page size. Adapters must clamp to their own maximum rather than error. */
  limit?: number;
  cursor?: string | null;
}
