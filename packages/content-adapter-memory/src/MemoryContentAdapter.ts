import {
  composeAbsolutePattern,
  findParentCycle,
  isRoutePatternError,
  normalizePattern,
  paramMetaToRecord,
  parseRoutePattern,
  RouteCompositionConflictError,
  RouteCompositionError,
  type ContentAdapterError,
  type ContentAdapter,
  type ContentWriter,
  type Locale,
  type RouteBundle,
  type RouteComposition,
  type RouteCompositionInput,
  type RouteCompositionReader,
  type RouteCompositionSummary,
  type RouteCompositionWriter,
  type RouteHeader,
  type RouteParamSpec,
  type RouteSectionNode,
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
 * A seed route.
 *
 * The absolute `path` is *derived* — from {@link pathSegment} (this route's own
 * contribution) and the parent chain — so a nested seed only states its segment
 * and its `parentId`. A flat seed states `path` directly and leaves both unset;
 * `pathSegment` then defaults to `path` and `parentId` to `null`. Header fields
 * (`name`, `published`) are optional: a seed that omits them is a live fixture
 * named after its path.
 */
export interface RouteSeed {
  id: string;
  /** Absolute path for a flat / top-level route. Omit when using {@link pathSegment}. */
  path?: string;
  /** This route's own path contribution. Defaults to {@link path}. */
  pathSegment?: string;
  /** Parent route id, or `null`/omitted for a top-level route. */
  parentId?: string | null;
  /** Author metadata for the path's `:name` parameters. */
  params?: readonly RouteParamSpec[];
  tree: readonly RouteSectionNode[];
  name?: string;
  published?: boolean;
  /** Optional in a seed — a fixture route with no SEO simply omits it. */
  seo?: RouteBundle["seo"];
  version: number;
  updatedAt: string;
}

export interface MemoryContentSeed {
  /** `locale -> messages` */
  messages?: Record<Locale, Record<string, string>>;
  /**
   * Published route bundles, as section-instance trees.
   *
   * Not `readonly`: `saveComposition` mutates this array in place — one class
   * over one mutable seed, so a save is visible to the next read.
   */
  routes?: RouteSeed[];
  /** Locale served when a requested one is missing. Kept for parity with the real adapters. */
  defaultLocale?: Locale;
  /** Timestamp stamped on generated rows, so output is deterministic. */
  updatedAt?: string;
}

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
  readonly #seed: Required<Pick<MemoryContentSeed, "defaultLocale" | "updatedAt">> &
    MemoryContentSeed;
  readonly #failWith?: ContentAdapterError;

  constructor(seed: MemoryContentSeed = {}, options: MemoryContentAdapterOptions = {}) {
    this.#seed = {
      defaultLocale: "en",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...seed,
    };
    this.#failWith = options.failWith;
  }

  async getRouteManifest(locale: Locale): Promise<readonly RouteBundle[]> {
    this.#guard();
    void locale;
    // Only published routes — a seed route with no `published` flag is a
    // fixture and counts as live; `saveComposition` can create drafts.
    return this.#publishedRoutes().map((route) => this.#toBundle(route));
  }

  async getRouteHeaders(): Promise<readonly RouteHeader[]> {
    this.#guard();
    return this.#publishedRoutes().map((route) => {
      const bundle = this.#toBundle(route);
      const title: Record<string, string | undefined> = {};
      for (const [routeLocale, seo] of Object.entries(bundle.seo)) {
        title[routeLocale] = seo.title;
      }
      return {
        id: bundle.id,
        pathSegment: bundle.pathSegment,
        path: bundle.path,
        parentId: bundle.parentId,
        hasParams: bundle.paramNames.length > 0,
        title,
      };
    });
  }

  async listCompositions(): Promise<readonly RouteCompositionSummary[]> {
    this.#guard();
    return (this.#seed.routes ?? []).map((route) => {
      const bundle = this.#toBundle(route);
      return {
        id: bundle.id,
        name: route.name ?? bundle.path,
        path: bundle.path,
        pathSegment: bundle.pathSegment,
        parentId: bundle.parentId,
        published: route.published ?? true,
        version: route.version,
        updatedAt: route.updatedAt,
      };
    });
  }

  async getComposition(bundleId: string): Promise<RouteComposition | null> {
    this.#guard();
    const route = (this.#seed.routes ?? []).find((candidate) => candidate.id === bundleId);
    if (!route) return null;
    const bundle = this.#toBundle(route);
    return {
      id: bundle.id,
      name: route.name ?? bundle.path,
      path: bundle.path,
      pathSegment: bundle.pathSegment,
      parentId: bundle.parentId,
      published: route.published ?? true,
      version: route.version,
      tree: route.tree,
      seo: route.seo ?? {},
      params: [...(route.params ?? [])],
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
  // this same class because both sides share the one mutable `#seed`, so a
  // save is visible to the next read in local dev with no backend.

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

    const parentId = input.parentId ?? null;
    const pathSegment = input.pathSegment ?? input.path;
    const params = [...(input.params ?? [])];

    // Parent + cycle checks. These mirror the invariants the Supabase RPC
    // enforces transactionally, so the shared contract stays meaningful.
    if (parentId !== null) {
      if (parentId === bundleId) {
        throw new RouteCompositionError("invalid", "A route cannot be its own parent.");
      }
      if (!routes.some((route) => route.id === parentId)) {
        throw new RouteCompositionError("invalid", `Parent route ${parentId} does not exist.`);
      }
      if (bundleId !== null) {
        const byId = new Map(
          routes.map((route) => [route.id, { id: route.id, parentId: route.parentId ?? null }]),
        );
        if (findParentCycle(bundleId, parentId, byId)) {
          throw new RouteCompositionError("invalid", "That parent would create a cycle.");
        }
      }
    }

    const resolvedPath = this.#composePath(parentId, pathSegment);

    // Structural-collision guard — the in-memory mirror of the DB's
    // `unique (normalized_path)`. A rename or reparent doesn't only move this
    // route's own path: every existing descendant's absolute path is derived
    // from it too (`#absolutePath` walks the live parent chain), so moving the
    // parent can silently collide a *descendant's* path with an unrelated
    // route even when this route's own new path is fine on its own. Postgres
    // catches exactly this — `route_recompute_subtree_paths` runs inside a
    // `unique_violation` trap in `save_route_composition` — so this mirrors it:
    // recompute what the whole moved subtree's paths *would* become, and check
    // every one of them against every route outside that subtree, before
    // committing anything.
    const descendantIds = bundleId ? this.#descendantIds(bundleId, routes) : [];
    const movedSubtree = new Set<string>(bundleId ? [bundleId, ...descendantIds] : []);
    // `path: undefined` forces `#absolutePath` to recompute this route's own
    // top-level path from the new `pathSegment` rather than reusing the stale
    // literal `path` a root route stores.
    const hypothetical = bundleId
      ? routes.map((route) =>
          route.id === bundleId ? { ...route, pathSegment, parentId, path: undefined } : route,
        )
      : routes;

    const toCheck: { id: string | null; path: string }[] = [{ id: bundleId, path: resolvedPath }];
    for (const id of descendantIds) {
      const seed = hypothetical.find((route) => route.id === id);
      if (seed) toCheck.push({ id, path: this.#absolutePath(seed, hypothetical) });
    }

    for (const { id, path } of toCheck) {
      const normalized = safeNormalize(path);
      for (const other of routes) {
        if (movedSubtree.has(other.id)) continue;
        if (safeNormalize(this.#absolutePath(other)) !== normalized) continue;

        if (id === bundleId) {
          // This route's own path — matches the DB's `on conflict` guard.
          throw new RouteCompositionError(
            "conflict",
            `Another route already matches the pattern "${path}".`,
          );
        }
        // A descendant would be dragged onto an existing pattern by this
        // rename/reparent — the DB raises PT422 (-> "invalid") from the
        // `route_recompute_subtree_paths` unique_violation trap; match that.
        throw new RouteCompositionError(
          "invalid",
          `This change would move a descendant route to "${path}", which already matches another route.`,
        );
      }
    }

    // Publish invariants: a live child needs live ancestors; a parent cannot go
    // back to draft while a child is live.
    if (input.published && parentId !== null && !this.#ancestorsPublished(parentId, routes)) {
      throw new RouteCompositionError(
        "invalid",
        "Publish the parent route before publishing this one.",
      );
    }
    if (
      !input.published &&
      bundleId !== null &&
      routes.some((route) => (route.parentId ?? null) === bundleId && route.published !== false)
    ) {
      throw new RouteCompositionError(
        "invalid",
        "Unpublish or reparent the published child routes first.",
      );
    }

    const nextSeed = (base: Partial<RouteSeed>): RouteSeed => ({
      id: base.id ?? randomUUID(),
      name: input.name,
      // A top-level route stores its absolute path; a nested one derives it.
      path: parentId === null ? resolvedPath : undefined,
      pathSegment,
      parentId,
      params,
      published: input.published,
      tree: input.tree,
      seo: input.seo,
      version: (base.version ?? 0) + 1,
      updatedAt: now,
    });

    if (bundleId === null) {
      const created = nextSeed({});
      routes.push(created);
      return this.#toBundle(created);
    }

    const index = routes.findIndex((route) => route.id === bundleId);
    if (index === -1) {
      throw new RouteCompositionError("not_found", `No route bundle ${bundleId}.`);
    }
    const current = routes[index]!;
    if (expectedVersion !== null && current.version !== expectedVersion) {
      throw new RouteCompositionConflictError(expectedVersion, current.version);
    }

    // Descendants read their absolute path through `#absolutePath`, so a
    // segment or parent change here is reflected with no explicit recompute.
    const updated = nextSeed({ id: current.id, version: current.version });
    routes[index] = updated;
    return this.#toBundle(updated);
  }

  async deleteComposition(bundleId: string, expectedVersion: number, actor: string): Promise<void> {
    this.#guard();
    void actor;

    const routes = this.#seed.routes ?? [];
    const index = routes.findIndex((route) => route.id === bundleId);
    if (index === -1) {
      throw new RouteCompositionError("not_found", `No route bundle ${bundleId}.`);
    }
    const current = routes[index]!;
    if (current.version !== expectedVersion) {
      throw new RouteCompositionConflictError(expectedVersion, current.version);
    }
    if (routes.some((route) => (route.parentId ?? null) === bundleId)) {
      throw new RouteCompositionError(
        "invalid",
        "This route has child routes — delete them first, or use deleteSubtree.",
      );
    }
    routes.splice(index, 1);
  }

  async deleteSubtree(bundleId: string, expectedVersion: number, actor: string): Promise<void> {
    this.#guard();
    void actor;

    const routes = this.#seed.routes ?? [];
    const root = routes.find((route) => route.id === bundleId);
    if (!root) {
      throw new RouteCompositionError("not_found", `No route bundle ${bundleId}.`);
    }
    if (root.version !== expectedVersion) {
      throw new RouteCompositionConflictError(expectedVersion, root.version);
    }

    const doomed = new Set<string>([bundleId]);
    for (let grew = true; grew;) {
      grew = false;
      for (const route of routes) {
        const parent = route.parentId ?? null;
        if (parent && doomed.has(parent) && !doomed.has(route.id)) {
          doomed.add(route.id);
          grew = true;
        }
      }
    }

    this.#seed.routes = routes.filter((route) => !doomed.has(route.id));
  }

  // ContentWriter — UI-chrome messages only. On the same class as the reader
  // for the same reason as route composition: one mutable `#seed`.

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

  #publishedRoutes(): RouteSeed[] {
    return (this.#seed.routes ?? []).filter((route) => route.published !== false);
  }

  /**
   * The absolute path pattern for a seed, walking its parent chain.
   *
   * `routes` defaults to the live seed array; `saveComposition`'s collision
   * guard passes a hypothetical one instead, to recompute what a descendant's
   * path *would* become under a rename or reparent that hasn't been committed
   * yet.
   */
  #absolutePath(
    seed: RouteSeed,
    routes: readonly RouteSeed[] = this.#seed.routes ?? [],
    seen: Set<string> = new Set(),
  ): string {
    const parentId = seed.parentId ?? null;
    const ownSegment = seed.pathSegment ?? seed.path ?? "/";
    if (!parentId || seen.has(seed.id)) return seed.path ?? ownSegment;

    seen.add(seed.id);
    const parent = routes.find((route) => route.id === parentId);
    if (!parent) return seed.path ?? ownSegment;

    try {
      return composeAbsolutePattern(this.#absolutePath(parent, routes, seen), ownSegment);
    } catch {
      return seed.path ?? ownSegment;
    }
  }

  /** `id`'s descendants (not including itself), computed from the flat seed list. */
  #descendantIds(id: string, routes: readonly RouteSeed[]): string[] {
    const childrenOf = new Map<string, string[]>();
    for (const route of routes) {
      const parent = route.parentId ?? null;
      if (parent)
        (childrenOf.get(parent) ?? childrenOf.set(parent, []).get(parent)!).push(route.id);
    }
    const out: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const child of childrenOf.get(current) ?? []) {
        out.push(child);
        stack.push(child);
      }
    }
    return out;
  }

  /** Composes the absolute pattern for a route about to be written. */
  #composePath(parentId: string | null, segment: string): string {
    try {
      if (parentId === null) return parseRoutePattern(segment).raw;
      const parent = (this.#seed.routes ?? []).find((route) => route.id === parentId);
      return composeAbsolutePattern(parent ? this.#absolutePath(parent) : "/", segment);
    } catch (error) {
      if (isRoutePatternError(error)) {
        throw new RouteCompositionError("invalid", error.message);
      }
      throw error;
    }
  }

  #ancestorsPublished(parentId: string, routes: readonly RouteSeed[]): boolean {
    const seen = new Set<string>();
    let currentId: string | null = parentId;
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const ancestor = routes.find((route) => route.id === currentId);
      if (!ancestor) return true; // an orphaned chain is the shell's problem, not this write's
      if (ancestor.published === false) return false;
      currentId = ancestor.parentId ?? null;
    }
    return true;
  }

  #toBundle(seed: RouteSeed): RouteBundle {
    const path = this.#absolutePath(seed);
    return {
      id: seed.id,
      path,
      pathSegment: seed.pathSegment ?? seed.path ?? path,
      parentId: seed.parentId ?? null,
      paramNames: safeParamNames(path),
      paramMeta: paramMetaToRecord((seed.params ?? []).map((param) => ({ ...param }))),
      tree: seed.tree,
      seo: seed.seo ?? {},
      version: seed.version,
      updatedAt: seed.updatedAt,
    };
  }
}

function safeNormalize(pattern: string): string {
  try {
    return normalizePattern(pattern);
  } catch {
    return pattern;
  }
}

function safeParamNames(pattern: string): readonly string[] {
  try {
    return parseRoutePattern(pattern).paramNames;
  } catch {
    return [];
  }
}
