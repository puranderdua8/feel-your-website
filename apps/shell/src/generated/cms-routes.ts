// @generated — do not hand-edit.
// This file mirrors a published CMS route. Change it in the CMS, then run
// `pnpm --filter @feel-your-website/shell routes:sync` to update
// routes.snapshot.json, and `routes:generate` (or a full build) to
// regenerate this file. `routes:generate --check` fails CI on drift.

/** One published, build-generated CMS route — enough to filter nav and drive offline precaching. */
export interface CmsRouteManifestEntry {
  readonly routeKey: string;
  readonly path: string;
  readonly offline: boolean;
}

/** Every route `routes:generate` produced this build, from routes.snapshot.json. */
export const CMS_ROUTES: readonly CmsRouteManifestEntry[] = [
  {
    "routeKey": "blog",
    "path": "/blog",
    "offline": false
  },
  {
    "routeKey": "blog-slug",
    "path": "/blog/:slug",
    "offline": false
  },
  {
    "routeKey": "help",
    "path": "/help",
    "offline": false
  },
  {
    "routeKey": "releases",
    "path": "/releases",
    "offline": false
  }
];

/** Hash of the snapshot this manifest was generated from — see `snapshot.ts`'s `hashSnapshot`. */
export const CMS_ROUTES_SNAPSHOT_HASH = "dac2fbb9";
