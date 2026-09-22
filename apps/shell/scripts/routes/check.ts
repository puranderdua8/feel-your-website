import type { SnapshotSourceBundle } from "./snapshot.js";
import type { RoutesSnapshot } from "./snapshot.js";

export interface SnapshotDrift {
  /** Published in the CMS but not yet in the committed snapshot — "pending, not in code yet". */
  readonly missingFromSnapshot: readonly string[];
  /** In the committed snapshot but no longer published (unpublished or deleted). */
  readonly removedFromCms: readonly string[];
}

/** `routes:check --against <env>` — reports drift without touching any file. */
export function diffAgainstSnapshot(
  published: readonly SnapshotSourceBundle[],
  snapshot: RoutesSnapshot,
): SnapshotDrift {
  const publishedKeys = new Set(published.map((b) => b.routeKey));
  const snapshotKeys = new Set(snapshot.routes.map((r) => r.routeKey));

  return {
    missingFromSnapshot: [...publishedKeys].filter((k) => !snapshotKeys.has(k)).sort(),
    removedFromCms: [...snapshotKeys].filter((k) => !publishedKeys.has(k)).sort(),
  };
}
