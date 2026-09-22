import { treeHasOutlet, type ContentAdapter } from "@feel-your-website/content-core";

import { buildSnapshot, type SnapshotSourceBundle } from "./snapshot.js";

/** The published route set, shaped for `buildSnapshot` — one adapter call, one locale. */
export async function fetchSnapshotSourceBundles(
  adapter: ContentAdapter,
  locale: string,
): Promise<SnapshotSourceBundle[]> {
  const bundles = await adapter.getRouteManifest(locale);
  return bundles.map((b) => ({
    id: b.id,
    routeKey: b.routeKey,
    path: b.path,
    parentId: b.parentId,
    offline: b.offline,
    paramNames: b.paramNames,
    hasOutlet: treeHasOutlet(b.tree),
  }));
}

export async function buildSnapshotFromAdapter(adapter: ContentAdapter, locale: string) {
  const bundles = await fetchSnapshotSourceBundles(adapter, locale);
  return buildSnapshot(bundles);
}
