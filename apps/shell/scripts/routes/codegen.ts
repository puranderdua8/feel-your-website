import type { GeneratedRouteFile } from "./mapping.js";
import type { RoutesSnapshot } from "./snapshot.js";
import { hashSnapshot } from "./snapshot.js";

/**
 * Renders the actual TypeScript source `routes:generate` writes. Every
 * generated value here has already passed `mapping.ts`'s validation
 * (slug-rule segments, identifier param names) before reaching this module —
 * per the plan's codegen-safety finding, nothing else (titles, SEO, arbitrary
 * CMS content) is ever emitted into generated source, and every value is
 * still routed through `JSON.stringify` rather than interpolated raw.
 */

const GENERATED_HEADER = `// @generated — do not hand-edit.
// This file mirrors a published CMS route. Change it in the CMS, then run
// \`pnpm --filter @feel-your-website/shell routes:sync\` to update
// routes.snapshot.json, and \`routes:generate\` (or a full build) to
// regenerate this file. \`routes:generate --check\` fails CI on drift.
`;

/** The `createFileRoute(...)` id TanStack expects for a file at `relativePath` under `(cms)/`. */
function routeIdFor(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.tsx$/, "");
  if (withoutExt === "index") return "/(cms)/";
  if (withoutExt === "route") return "/(cms)";
  if (withoutExt.endsWith("/index")) return `/(cms)/${withoutExt.slice(0, -"/index".length)}/`;
  if (withoutExt.endsWith("/route")) return `/(cms)/${withoutExt.slice(0, -"/route".length)}`;
  return `/(cms)/${withoutExt}`;
}

/**
 * A leaf file: either fetches and renders its own bundle (no CMS ancestor
 * fold — plan finding 3), or, for the exact-index half of a layout pair
 * (`file.source.hasOutlet`, sharing its `routeKey` with the sibling
 * `route.tsx`), renders nothing — the layout already owns that bundle.
 *
 * `wrap` (true only when this bundle has no CMS ancestor, i.e.
 * `parentKey === null`) is baked in here rather than computed at runtime:
 * whichever bundle sits outermost on the page owns the `<main>` landmark
 * once, and that's a fact about the route tree, not about a single request.
 */
export function renderLeafFile(file: GeneratedRouteFile): string {
  const id = routeIdFor(file.relativePath);

  if (file.source.hasOutlet) {
    return `${GENERATED_HEADER}
import { createFileRoute } from "@tanstack/react-router";

import { NullRouteComponent } from "@/cms-route";

export const Route = createFileRoute(${JSON.stringify(id)})({
  component: NullRouteComponent,
});
`;
  }

  const wrap = file.source.parentKey === null;
  return `${GENERATED_HEADER}
import { createFileRoute } from "@tanstack/react-router";

import { cmsHead, cmsLoader, cmsRouteComponent } from "@/cms-route";

export const Route = createFileRoute(${JSON.stringify(id)})({
  loader: (ctx) => cmsLoader(ctx, ${JSON.stringify(file.routeKey)}),
  head: cmsHead,
  component: cmsRouteComponent(${JSON.stringify(wrap)}),
});
`;
}

/**
 * A layout file: fetches and renders its own bundle, with `<Outlet/>` filling
 * whatever outlet node that bundle's tree carries — the sibling `index.tsx`
 * (same `routeKey`) renders nothing, since this file already owns it.
 */
export function renderLayoutFile(file: GeneratedRouteFile): string {
  const id = routeIdFor(file.relativePath);
  const wrap = file.source.parentKey === null;
  return `${GENERATED_HEADER}
import { createFileRoute } from "@tanstack/react-router";

import { cmsHead, cmsLayoutRouteComponent, cmsLoader } from "@/cms-route";

export const Route = createFileRoute(${JSON.stringify(id)})({
  loader: (ctx) => cmsLoader(ctx, ${JSON.stringify(file.routeKey)}),
  head: cmsHead,
  component: cmsLayoutRouteComponent(${JSON.stringify(wrap)}),
});
`;
}

export function renderGeneratedFile(file: GeneratedRouteFile): string {
  return file.kind === "layout" ? renderLayoutFile(file) : renderLeafFile(file);
}

/**
 * `src/generated/cms-routes.ts` — the build manifest the shell's nav filters
 * against (plan finding 6) and `/build-info.json` embeds the hash of. Plain
 * data, not components, so it's cheap to import from both server and client.
 */
export function renderManifest(snapshot: RoutesSnapshot): string {
  const entries = [...snapshot.routes]
    .sort((a, b) => a.routeKey.localeCompare(b.routeKey))
    .map((r) => ({
      routeKey: r.routeKey,
      path: r.path,
      offline: r.offline,
    }));

  return `${GENERATED_HEADER}
/** One published, build-generated CMS route — enough to filter nav and drive offline precaching. */
export interface CmsRouteManifestEntry {
  readonly routeKey: string;
  readonly path: string;
  readonly offline: boolean;
}

/** Every route \`routes:generate\` produced this build, from routes.snapshot.json. */
export const CMS_ROUTES: readonly CmsRouteManifestEntry[] = ${JSON.stringify(entries, null, 2)};

/** Hash of the snapshot this manifest was generated from — see \`snapshot.ts\`'s \`hashSnapshot\`. */
export const CMS_ROUTES_SNAPSHOT_HASH = ${JSON.stringify(hashSnapshot(snapshot))};
`;
}
