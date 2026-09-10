import {
  collectInvocations,
  planInvocations,
  runQueries,
  SECTION_QUERY_REGISTRY,
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
}

/**
 * Runs every data-backed section's query for a resolved page, all under one
 * shared abort budget, and returns a {@link SectionDataEntry} per section
 * instance.
 *
 * Returns `{}` when no section on the page references a query action — the
 * common case while `SECTION_QUERY_REGISTRY` is empty — without touching the
 * invoker. Never throws: `runQueries` already turns a failed call into an
 * error entry, and an unexpected throw here degrades the whole fan-out to `{}`
 * so the page still renders.
 */
export async function loadRouteSectionData(
  page: RoutePage,
  invoker: QueryInvoker,
  options: LoadOptions = {},
): Promise<Record<string, SectionDataEntry>> {
  const registry = options.registry ?? SECTION_QUERY_REGISTRY;
  const now = options.now ?? Date.now;

  const collected = collectInvocations(
    page.layers.map((layer) => layer.tree),
    page.locale,
    routeRenderContext(page),
    registry,
  );
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
