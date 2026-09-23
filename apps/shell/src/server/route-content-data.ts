import {
  collectInvocations,
  partitionInvocations,
  planInvocations,
  runQueries,
  SECTION_QUERY_REGISTRY,
  type QueryInvoker,
  type RouteRenderContext,
  type SectionDataEntry,
  type SectionQuerySpec,
} from "@feel-your-website/section-registry";

import type { RouteContentResult } from "./route-content.js";

/**
 * Fetches a single bundle's own section data, never an ancestor chain's.
 * Each route level (layout, leaf) runs its own independent fan-out under the
 * same shared budget — one fan-out per bundle, not one for a whole page,
 * since there is no longer one server call resolving a whole page (plan
 * finding 3).
 */

/**
 * Total wall-clock budget for one bundle's whole query fan-out. Deliberately
 * below `CONTENT_TIMEOUT_MS` (5s): a slow upstream must degrade one section to
 * its fallback, never stall the SSR response.
 */
export const SECTION_QUERY_BUDGET_MS = 3_500;

/** The route facts a section's `deriveInvocation` may read, for one resolved bundle. */
export function routeContentRenderContext(
  resolved: RouteContentResult,
  pathname: string,
  locale: string,
): RouteRenderContext {
  return {
    params: resolved.params,
    pathname,
    pattern: resolved.bundle.path,
    // No ancestor-chain walk here (see route-content.ts's doc comment) — no
    // `deriveInvocation` reads `chain` today, and breadcrumbs come from
    // `useMatches()` client-side, not from a render context built here.
    chain: [],
    locale,
  };
}

interface LoadOptions {
  readonly registry?: Readonly<Record<string, SectionQuerySpec>>;
  readonly now?: () => number;
  readonly phase?: "blocking" | "deferred" | "all";
}

function collectFor(
  resolved: RouteContentResult,
  pathname: string,
  locale: string,
  registry: Readonly<Record<string, SectionQuerySpec>>,
) {
  return collectInvocations(
    [resolved.bundle.tree],
    locale,
    routeContentRenderContext(resolved, pathname, locale),
    registry,
  );
}

/** Instance ids of this bundle's non-blocking sections — the client fetches these after paint. */
export function deferredRouteContentSectionIds(
  resolved: RouteContentResult,
  pathname: string,
  locale: string,
  registry: Readonly<Record<string, SectionQuerySpec>> = SECTION_QUERY_REGISTRY,
): string[] {
  return partitionInvocations(collectFor(resolved, pathname, locale, registry)).deferred.map(
    (i) => i.instanceId,
  );
}

/** Runs one bundle's data-backed sections' queries (see `phase`), never an ancestor chain's. */
export async function loadRouteContentSectionData(
  resolved: RouteContentResult,
  pathname: string,
  locale: string,
  invoker: QueryInvoker,
  options: LoadOptions = {},
): Promise<Record<string, SectionDataEntry>> {
  const registry = options.registry ?? SECTION_QUERY_REGISTRY;
  const now = options.now ?? Date.now;
  const phase = options.phase ?? "blocking";

  const all = collectFor(resolved, pathname, locale, registry);
  const split = partitionInvocations(all);
  const collected = phase === "all" ? all : phase === "deferred" ? split.deferred : split.blocking;
  if (collected.length === 0) return {};

  const plan = planInvocations(collected);
  const startedAt = now();
  try {
    const data = await runQueries(plan, invoker, {
      registry,
      budgetMs: SECTION_QUERY_BUDGET_MS,
    });
    console.info(
      `[actions] ${plan.unique.length} query call(s) for route "${resolved.bundle.routeKey}" in ${now() - startedAt}ms`,
    );
    return data;
  } catch (error) {
    console.error(`[actions] query fan-out failed for route "${resolved.bundle.routeKey}":`, error);
    return {};
  }
}
