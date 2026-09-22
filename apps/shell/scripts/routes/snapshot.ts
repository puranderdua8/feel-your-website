/**
 * The committed `routes.snapshot.json` schema and its pure read/write/build
 * logic — no CMS, no filesystem here beyond JSON (de)serialisation, so this
 * module is trivially unit-testable.
 *
 * Deliberately **no bundle UUIDs and no timestamps**: a snapshot built from
 * two different databases (memory fixtures, a local Supabase, the hosted
 * project) for the same published routes must serialise identically, and a
 * `route_key` is the only identity that holds across them (see
 * `RouteBundle.routeKey`). Sorted by `routeKey` so `routes:sync` produces a
 * stable diff — re-running it with no CMS changes must not touch the file.
 */

/** One published route, as `routes:generate` needs it — nothing more. */
export interface SnapshotRoute {
  readonly routeKey: string;
  /** The absolute path pattern — see `RouteBundle.path`. */
  readonly path: string;
  /** The parent's `routeKey`, or `null` for a top-level route. */
  readonly parentKey: string | null;
  /** Whether this route's tree carries an `outlet` node — see `RouteBundle` docs. */
  readonly hasOutlet: boolean;
  readonly offline: boolean;
  /** `:name` parameters, in order — mirrors `RouteBundle.paramNames`. */
  readonly paramNames: readonly string[];
}

export interface RoutesSnapshot {
  readonly version: 1;
  readonly routes: readonly SnapshotRoute[];
}

const CURRENT_VERSION = 1;

/** Deterministic ordering: by `routeKey`, which is unique. */
function sortRoutes(routes: readonly SnapshotRoute[]): SnapshotRoute[] {
  return [...routes].sort((a, b) => a.routeKey.localeCompare(b.routeKey));
}

/** Builds a snapshot from published route bundles, minimal input `buildSnapshot` actually needs. */
export interface SnapshotSourceBundle {
  readonly id: string;
  readonly routeKey: string;
  readonly path: string;
  readonly parentId: string | null;
  readonly offline: boolean;
  readonly paramNames: readonly string[];
  readonly hasOutlet: boolean;
}

/**
 * Turns published route bundles (already resolved to `hasOutlet`, id-keyed
 * `parentId`) into a sorted, stable {@link RoutesSnapshot} — id-based
 * `parentId` is resolved to the parent's `routeKey` here, the one place a
 * UUID is allowed to exist before it's discarded.
 */
export function buildSnapshot(bundles: readonly SnapshotSourceBundle[]): RoutesSnapshot {
  const keyById = new Map(bundles.map((b) => [b.id, b.routeKey]));

  const routes: SnapshotRoute[] = bundles.map((b) => ({
    routeKey: b.routeKey,
    path: b.path,
    parentKey: b.parentId ? (keyById.get(b.parentId) ?? null) : null,
    hasOutlet: b.hasOutlet,
    offline: b.offline,
    paramNames: [...b.paramNames],
  }));

  return { version: CURRENT_VERSION, routes: sortRoutes(routes) };
}

/** Serialises a snapshot to the exact bytes `routes:sync` writes to disk. */
export function serializeSnapshot(snapshot: RoutesSnapshot): string {
  const stable: RoutesSnapshot = { version: snapshot.version, routes: sortRoutes(snapshot.routes) };
  return `${JSON.stringify(stable, null, 2)}\n`;
}

export class SnapshotParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotParseError";
  }
}

/** Parses and shape-validates a snapshot read from disk. Throws {@link SnapshotParseError}. */
export function parseSnapshot(raw: string): RoutesSnapshot {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new SnapshotParseError(
      `routes.snapshot.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new SnapshotParseError("routes.snapshot.json must be a JSON object.");
  }
  const obj = json as Record<string, unknown>;
  if (obj.version !== CURRENT_VERSION) {
    throw new SnapshotParseError(
      `routes.snapshot.json has unsupported "version" ${JSON.stringify(obj.version)}; expected ${CURRENT_VERSION}.`,
    );
  }
  if (!Array.isArray(obj.routes)) {
    throw new SnapshotParseError('routes.snapshot.json\'s "routes" must be an array.');
  }

  const routes = obj.routes.map((entry, i) => parseSnapshotRoute(entry, i));
  return { version: CURRENT_VERSION, routes: sortRoutes(routes) };
}

function parseSnapshotRoute(entry: unknown, index: number): SnapshotRoute {
  const fail = (msg: string): never => {
    throw new SnapshotParseError(`routes.snapshot.json's routes[${index}] ${msg}`);
  };
  if (!entry || typeof entry !== "object") return fail("must be an object.");
  const r = entry as Record<string, unknown>;

  const routeKey = r.routeKey;
  const routePath = r.path;
  const parentKey = r.parentKey;
  const hasOutlet = r.hasOutlet;
  const offline = r.offline;
  const paramNames = r.paramNames;

  if (typeof routeKey !== "string" || routeKey === "") return fail('needs a non-empty "routeKey".');
  if (typeof routePath !== "string" || !routePath.startsWith("/")) {
    return fail('needs "path" starting with "/".');
  }
  if (parentKey !== null && typeof parentKey !== "string") {
    return fail('"parentKey" must be a string or null.');
  }
  if (typeof hasOutlet !== "boolean") return fail('needs a boolean "hasOutlet".');
  if (typeof offline !== "boolean") return fail('needs a boolean "offline".');
  if (!Array.isArray(paramNames) || !paramNames.every((p) => typeof p === "string")) {
    return fail('needs a string array "paramNames".');
  }

  return { routeKey, path: routePath, parentKey, hasOutlet, offline, paramNames };
}

/** A short, stable hash of a snapshot's route set — embedded in `cms-routes.ts` and `build-info.json`. */
export function hashSnapshot(snapshot: RoutesSnapshot): string {
  // FNV-1a over the serialised (sorted, canonical) form — no crypto import
  // needed, and this only has to be stable and collision-resistant enough to
  // flag "the deployed build's routes differ from what's published", not
  // cryptographically secure.
  const bytes = serializeSnapshot(snapshot);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
