import {
  collectInvocations,
  partitionInvocations,
  planInvocations,
  runQueries,
  SECTION_QUERY_REGISTRY,
  type CollectedInvocation,
  type QueryInvoker,
  type RouteRenderContext,
  type SectionDataEntry,
  type SectionQuerySpec,
} from "@feel-your-website/section-registry";

import type { RoutePage } from "./resolve-route-page.js";

/**
 * Total wall-clock budget for one page's whole query fan-out. Deliberately
 * below `CONTENT_TIMEOUT_MS` (5s): a slow upstream must degrade one section to
 * its fallback, never stall the SSR response.
 */
export const SECTION_QUERY_BUDGET_MS = 3_500;

/** The route facts a section's `deriveInvocation` may read, taken off a resolved page. */
export function routeRenderContext(page: RoutePage): RouteRenderContext {
  return {
    params: page.params,
    pathname: page.pathname,
    pattern: page.pattern,
    chain: page.chain,
    locale: page.locale,
  };
}

interface LoadOptions {
  /** Override the section→query registry. Defaults to the shared one. */
  readonly registry?: Readonly<Record<string, SectionQuerySpec>>;
  /** Clock injection for tests. */
  readonly now?: () => number;
  /**
   * Which sections to run: `"blocking"` (the default — the SSR pass; a
   * `blocking: false` spec is left for the client), `"deferred"` (the
   * client-refetch pass), or `"all"`.
   */
  readonly phase?: "blocking" | "deferred" | "all";
}

function collectFor(
  page: RoutePage,
  registry: Readonly<Record<string, SectionQuerySpec>>,
): CollectedInvocation[] {
  return collectInvocations(
    page.layers.map((layer) => layer.tree),
    page.locale,
    routeRenderContext(page),
    registry,
  );
}

/** Instance ids of the page's non-blocking sections — the client fetches these after paint. */
export function deferredSectionIds(
  page: RoutePage,
  registry: Readonly<Record<string, SectionQuerySpec>> = SECTION_QUERY_REGISTRY,
): string[] {
  return partitionInvocations(collectFor(page, registry)).deferred.map((i) => i.instanceId);
}

/**
 * Runs a data-backed section's query for a resolved page (see `phase`), all
 * under one shared abort budget, and returns a {@link SectionDataEntry} per
 * section instance.
 *
 * Returns `{}` when nothing in that phase needs running — the common case
 * while `SECTION_QUERY_REGISTRY` is empty — without touching the invoker.
 * Never throws: `runQueries` already turns a failed call into an error entry,
 * and an unexpected throw here degrades to `{}` so the page still renders.
 */
export async function loadRouteSectionData(
  page: RoutePage,
  invoker: QueryInvoker,
  options: LoadOptions = {},
): Promise<Record<string, SectionDataEntry>> {
  const registry = options.registry ?? SECTION_QUERY_REGISTRY;
  const now = options.now ?? Date.now;
  const phase = options.phase ?? "blocking";

  const all = collectFor(page, registry);
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
      `[actions] ${plan.unique.length} query call(s) for ${page.pathname} in ${now() - startedAt}ms`,
    );
    return data;
  } catch (error) {
    console.error(`[actions] query fan-out failed for ${page.pathname}:`, error);
    return {};
  }
}
