import type { RouteHeader } from "@feel-your-website/content-core";

/** One node of the site-nav forest. */
export interface NavNode {
  id: string;
  /** Absolute path — a real URL, since param routes are excluded. */
  path: string;
  /** Display label for this locale. */
  title: string;
  children: NavNode[];
}

/** `/blog` -> `blog`; `/` -> `home`. Fallback label when a route has no title. */
function lastSegment(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? "home";
}

/**
 * Builds the site-nav forest from the published route headers.
 *
 * A route whose path carries a `:name` segment has no single URL, so it — and
 * everything under it — is left out of the menu; its static ancestors are
 * separate headers and stay. A header whose `parentId` names a route not in the
 * set (an unpublished parent) is treated as a root.
 *
 * Deliberately fed `getRouteHeaders()`, not `getRouteManifest()`: this runs in
 * `loadBootstrap` on every SSR navigation and must not pull section rows.
 */
export function buildNav(headers: readonly RouteHeader[], locale: string): NavNode[] {
  const usable = headers.filter((header) => !header.hasParams);
  const byId = new Map(usable.map((header) => [header.id, header]));

  const childrenOf = new Map<string | null, RouteHeader[]>();
  for (const header of usable) {
    const parentKey = header.parentId && byId.has(header.parentId) ? header.parentId : null;
    const group = childrenOf.get(parentKey);
    if (group) group.push(header);
    else childrenOf.set(parentKey, [header]);
  }

  const seen = new Set<string>();

  const build = (header: RouteHeader): NavNode => {
    seen.add(header.id);
    const kids = (childrenOf.get(header.id) ?? []).filter((kid) => !seen.has(kid.id)).map(build);
    return {
      id: header.id,
      path: header.path,
      title: header.title[locale] || lastSegment(header.path),
      children: sortNodes(kids),
    };
  };

  return sortNodes((childrenOf.get(null) ?? []).map(build));
}

function sortNodes(nodes: NavNode[]): NavNode[] {
  return [...nodes].sort((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path));
}
