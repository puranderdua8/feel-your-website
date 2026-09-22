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

/** A leaf file: fetches and renders — the whole page, or a layout's own-path SEO half. */
export function renderLeafFile(file: GeneratedRouteFile): string {
  const id = routeIdFor(file.relativePath);
  return `${GENERATED_HEADER}
import { createFileRoute } from "@tanstack/react-router";

import { cmsHead, cmsLoader, CmsRouteComponent } from "@/cms-route";

export const Route = createFileRoute(${JSON.stringify(id)})({
  loader: cmsLoader,
  head: cmsHead,
  component: CmsRouteComponent,
});
`;
}

/**
 * A layout file: renders only its matched child. No loader/head of its own —
 * see `cms-route.tsx`'s doc comment for why: the sibling `index.tsx` (or a
 * deeper leaf) already fetches and folds the whole ancestor chain in one
 * render.
 */
export function renderLayoutFile(file: GeneratedRouteFile): string {
  const id = routeIdFor(file.relativePath);
  return `${GENERATED_HEADER}
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(${JSON.stringify(id)})({
  component: Outlet,
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
