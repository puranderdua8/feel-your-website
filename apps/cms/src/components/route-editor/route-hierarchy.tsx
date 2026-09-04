import type { RouteCompositionSummary } from "@feel-your-website/content-core";

/** One route header plus its children, built from the flat summary list. */
export interface ForestNode {
  readonly summary: RouteCompositionSummary;
  readonly children: readonly ForestNode[];
}

/**
 * Groups a flat route list into a forest by `parentId`. A route whose parent
 * isn't in the list (unpublished elsewhere, or simply not loaded) becomes a
 * root — same rule the shell's nav builder uses. Root-first, siblings sorted
 * by name.
 */
export function buildRouteForest(summaries: readonly RouteCompositionSummary[]): ForestNode[] {
  const byId = new Map(summaries.map((s) => [s.id, s]));
  const childrenOf = new Map<string | null, RouteCompositionSummary[]>();
  for (const summary of summaries) {
    const key = summary.parentId && byId.has(summary.parentId) ? summary.parentId : null;
    (childrenOf.get(key) ?? childrenOf.set(key, []).get(key)!).push(summary);
  }

  const seen = new Set<string>();
  const build = (summary: RouteCompositionSummary): ForestNode => {
    seen.add(summary.id);
    const kids = (childrenOf.get(summary.id) ?? []).filter((kid) => !seen.has(kid.id));
    return { summary, children: sortByName(kids).map(build) };
  };

  return sortByName(childrenOf.get(null) ?? []).map(build);
}

function sortByName(summaries: RouteCompositionSummary[]): RouteCompositionSummary[] {
  return [...summaries].sort((a, b) => a.name.localeCompare(b.name));
}

/** Depth-first walk yielding every node with its depth (0 = root). */
export function* walkForest(
  nodes: readonly ForestNode[],
  depth = 0,
): Generator<{ node: ForestNode; depth: number }> {
  for (const node of nodes) {
    yield { node, depth };
    yield* walkForest(node.children, depth + 1);
  }
}

/** `id` plus every descendant id, computed from the flat list. Used to keep a route from becoming its own descendant's child. */
export function descendantIds(
  id: string,
  summaries: readonly RouteCompositionSummary[],
): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const s of summaries) {
    if (!s.parentId) continue;
    (childrenOf.get(s.parentId) ?? childrenOf.set(s.parentId, []).get(s.parentId)!).push(s.id);
  }
  const out = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return out;
}
