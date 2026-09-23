import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CMS_ROUTES, CMS_ROUTES_SNAPSHOT_HASH } from "../src/generated/cms-routes.js";

/**
 * Writes `dist/client/build-info.json` (plan Phase 5): the deployed build's
 * own route manifest — snapshot hash and route keys, both already computed
 * into `cms-routes.ts` by `routes:generate` — so the CMS can tell a route
 * that's published but hasn't reached a deployed build yet ("pending — not
 * in code yet") apart from one that's actually live. See
 * `apps/cms/src/server/deploy-status.ts`, the one reader of this file.
 *
 * Reads only the already-generated manifest, same as `generate-offline-data.ts`
 * reads only `CMS_ROUTES` — no adapter, no CMS reachability needed here either.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outFile = join(root, "dist", "client", "build-info.json");

const body = {
  snapshotHash: CMS_ROUTES_SNAPSHOT_HASH,
  builtAt: new Date().toISOString(),
  routes: CMS_ROUTES.map((route) => ({ routeKey: route.routeKey, path: route.path })),
};

await writeFile(outFile, JSON.stringify(body, null, 2));
console.log(
  `[build-info] ${CMS_ROUTES.length} route(s), hash ${CMS_ROUTES_SNAPSHOT_HASH} → dist/client/build-info.json`,
);
