import {
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
 * A seed route: a {@link RouteBundle} plus the config-bundle header fields the
 * CMS editor needs. A seed that omits them gets `name = path` and
 * `published = true` (a fixture route is live by default).
 */
export type RouteSeed = Omit<RouteBundle, "seo"> & {
  name?: string;
  published?: boolean;
  /** Optional in a seed — a fixture route with no SEO simply omits it. */
  seo?: RouteBundle["seo"];
};

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
    return (this.#seed.routes ?? [])
      .filter((route) => route.published !== false)
      .map((route) => ({
        id: route.id,
        path: route.path,
        tree: route.tree,
        seo: route.seo ?? {},
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
      seo: route.seo ?? {},
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

    if (bundleId === null) {
      const created: RouteSeed = {
        id: randomUUID(),
        name: input.name,
        path: input.path,
        published: input.published,
        tree: input.tree,
        seo: input.seo,
        version: 1,
        updatedAt: now,
      };
      routes.push(created);
      return {
        id: created.id,
        path: created.path,
        tree: created.tree,
        seo: input.seo,
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
      seo: input.seo,
      version: current.version + 1,
      updatedAt: now,
    };
    routes[index] = updated;
    return {
      id: updated.id,
      path: updated.path,
      tree: updated.tree,
      seo: input.seo,
      version: updated.version,
      updatedAt: now,
    };
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
    routes.splice(index, 1);
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
}
