import type { ActionDefinition } from "./types.js";

/** The code-defined set of registered actions, indexed for lookup. */
export interface ActionCatalog {
  readonly definitions: readonly ActionDefinition[];
  readonly byId: ReadonlyMap<string, ActionDefinition>;
  readonly values: readonly string[];
  readonly includes: (id: string) => boolean;
}

const SAFE_METHODS = new Set(["GET", "HEAD"]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Builds an {@link ActionCatalog}, rejecting at module load — the same way
 * `defineSections` rejects a duplicate key — anything the type system cannot
 * catch on its own:
 *
 * - a duplicated `id`;
 * - a `query` whose `method` is not safe, or a `mutation` whose `method` is;
 * - `cache` on a mutation, or `idempotent` / `confirm` on a query (only
 *   reachable through an `as` cast or a JS caller, but a broken catalog
 *   should fail here, not surface as odd behaviour later).
 */
export function defineActions(definitions: readonly ActionDefinition[]): ActionCatalog {
  const byId = new Map<string, ActionDefinition>();
  const duplicates = new Set<string>();

  for (const def of definitions) {
    if (byId.has(def.id)) duplicates.add(def.id);
    byId.set(def.id, def);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate action id(s): ${[...duplicates].sort().join(", ")}`);
  }

  for (const def of definitions) {
    if (def.kind === "query" && !SAFE_METHODS.has(def.method)) {
      throw new Error(`Action "${def.id}" is a query but its method is ${def.method}.`);
    }
    if (def.kind === "mutation" && !UNSAFE_METHODS.has(def.method)) {
      throw new Error(`Action "${def.id}" is a mutation but its method is ${def.method}.`);
    }
    // These are already type errors; the runtime checks only catch a catalog
    // built through an `as` cast or from JS. Read through a narrow structural
    // cast rather than `Record<string, unknown>`.
    if (def.kind === "mutation" && (def as { cache?: unknown }).cache !== undefined) {
      throw new Error(`Action "${def.id}" is a mutation and cannot declare a cache.`);
    }
    if (def.kind === "query") {
      const loose = def as { idempotent?: unknown; confirm?: unknown };
      if (loose.idempotent !== undefined) {
        throw new Error(`Action "${def.id}" is a query and cannot declare "idempotent".`);
      }
      if (loose.confirm !== undefined) {
        throw new Error(`Action "${def.id}" is a query and cannot declare "confirm".`);
      }
    }
  }

  return {
    definitions,
    byId,
    values: definitions.map((def) => def.id),
    includes: (id: string): boolean => byId.has(id),
  };
}

/**
 * The ids among `ids` not in the catalog, de-duplicated and sorted. Empty
 * means every id names a real action. The CMS calls this at publish time with
 * a route's referenced action ids.
 */
export function findUnknownActionIds(
  catalog: ActionCatalog,
  ids: readonly string[],
): readonly string[] {
  return [...new Set(ids.filter((id) => !catalog.includes(id)))].sort();
}
