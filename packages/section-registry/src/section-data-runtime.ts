import type { JsonValue, RouteSectionNode } from "@feel-your-website/content-core";
import { flattenNodes } from "@feel-your-website/content-core";

import type { RouteRenderContext } from "./context.js";
import type { SectionDataEntry } from "./registry.js";
import {
  SECTION_QUERY_REGISTRY,
  type QueryInvocation,
  type SectionQuerySpec,
} from "./section-data.js";

/** Default cap on one section instance's serialised data. */
export const SECTION_DATA_MAX_ENTRY_BYTES = 32 * 1024;

/** Minimal shape an invoker must satisfy — the real one comes from `action-core`. */
export interface QueryInvoker {
  invoke(
    actionId: string,
    body: Readonly<Record<string, JsonValue>>,
    context: { signal?: AbortSignal },
  ): Promise<
    { ok: true; data: JsonValue; stale?: boolean } | { ok: false; code: string; issues?: unknown }
  >;
}

export interface CollectedInvocation {
  readonly instanceId: string;
  readonly sectionKey: string;
  readonly invocation: QueryInvocation;
  readonly blocking: boolean;
}

/**
 * Walks every layer's section tree and, for each node whose `sectionKey` has
 * a query spec, derives its invocation. Nodes in slots are included
 * (`flattenNodes`). A spec whose `deriveInvocation` returns `null` is skipped.
 */
export function collectInvocations(
  trees: readonly (readonly RouteSectionNode[])[],
  locale: string,
  route: RouteRenderContext | undefined,
  registry: Readonly<Record<string, SectionQuerySpec>> = SECTION_QUERY_REGISTRY,
): CollectedInvocation[] {
  const out: CollectedInvocation[] = [];

  for (const tree of trees) {
    for (const node of flattenNodes(tree)) {
      const spec = registry[node.sectionKey];
      if (!spec) continue;

      const invocation = spec.deriveInvocation(node.content[locale] ?? {}, route);
      if (!invocation) continue;

      out.push({
        instanceId: node.instanceId,
        sectionKey: node.sectionKey,
        invocation,
        blocking: spec.blocking ?? true,
      });
    }
  }

  return out;
}

export interface FetchPlan {
  /** One entry per distinct `actionId` + body. */
  readonly unique: readonly QueryInvocation[];
  /** instanceId → index into `unique`. */
  readonly byInstance: ReadonlyMap<string, number>;
  /** instanceId → its section key, for per-instance `project`. */
  readonly sectionKeyByInstance: ReadonlyMap<string, string>;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

/** Collapses identical invocations so a page renders each distinct call once. */
export function planInvocations(collected: readonly CollectedInvocation[]): FetchPlan {
  const unique: QueryInvocation[] = [];
  const keyToIndex = new Map<string, number>();
  const byInstance = new Map<string, number>();
  const sectionKeyByInstance = new Map<string, string>();

  for (const item of collected) {
    const key = `${item.invocation.actionId}\0${stableStringify(item.invocation.body)}`;
    let index = keyToIndex.get(key);
    if (index === undefined) {
      index = unique.length;
      unique.push(item.invocation);
      keyToIndex.set(key, index);
    }
    byInstance.set(item.instanceId, index);
    sectionKeyByInstance.set(item.instanceId, item.sectionKey);
  }

  return { unique, byInstance, sectionKeyByInstance };
}

export interface RunQueriesOptions {
  readonly registry?: Readonly<Record<string, SectionQuerySpec>>;
  /**
   * Structural parse from the action catalog, keyed by `actionId`. Supplied by
   * the BFF (which has the catalog). Returns `null` to reject a payload;
   * omitted, the raw payload passes through.
   */
  readonly parseResult?: (actionId: string, raw: JsonValue) => JsonValue | null;
  /** Total wall-clock budget for the whole fan-out. */
  readonly budgetMs?: number;
  readonly maxEntryBytes?: number;
}

function bytesOf(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return Infinity;
  }
}

/**
 * Runs the planned query invocations against `invoker`, all under one shared
 * abort budget, and returns a `SectionDataEntry` per section instance.
 *
 * A rejected or `ok: false` call, a `parseResult` that returns `null`, a
 * `project` that returns `null`, or an over-cap payload each become
 * `{ ok: false, error: { code } }` — the page still renders, that section
 * shows its fallback.
 */
export async function runQueries(
  plan: FetchPlan,
  invoker: QueryInvoker,
  options: RunQueriesOptions = {},
): Promise<Record<string, SectionDataEntry>> {
  const registry = options.registry ?? SECTION_QUERY_REGISTRY;
  const maxBytes = options.maxEntryBytes ?? SECTION_DATA_MAX_ENTRY_BYTES;

  const controller = new AbortController();
  const timer =
    options.budgetMs !== undefined
      ? setTimeout(() => controller.abort(), options.budgetMs)
      : undefined;

  let settled: PromiseSettledResult<Awaited<ReturnType<QueryInvoker["invoke"]>>>[];
  try {
    settled = await Promise.allSettled(
      plan.unique.map((invocation) =>
        invoker.invoke(invocation.actionId, invocation.body, { signal: controller.signal }),
      ),
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  // One resolved-or-error value per unique invocation.
  const uniqueEntries: SectionDataEntry[] = settled.map((result, index) => {
    if (result.status === "rejected") {
      return { ok: false, error: { code: controller.signal.aborted ? "timeout" : "unavailable" } };
    }
    const value = result.value;
    if (!value.ok) return { ok: false, error: { code: value.code } };

    const actionId = plan.unique[index]!.actionId;
    const parsed = options.parseResult ? options.parseResult(actionId, value.data) : value.data;
    if (parsed === null) return { ok: false, error: { code: "invalid_response" } };
    return { ok: true, data: parsed };
  });

  const out: Record<string, SectionDataEntry> = {};
  for (const [instanceId, uniqueIndex] of plan.byInstance) {
    const base = uniqueEntries[uniqueIndex]!;
    if (!base.ok) {
      out[instanceId] = base;
      continue;
    }

    const spec = registry[plan.sectionKeyByInstance.get(instanceId) ?? ""];
    const projected = spec?.project ? spec.project(base.data as JsonValue) : base.data;
    if (projected === null || projected === undefined) {
      out[instanceId] = { ok: false, error: { code: "invalid_response" } };
      continue;
    }
    if (bytesOf(projected) > maxBytes) {
      out[instanceId] = { ok: false, error: { code: "invalid_request" } };
      continue;
    }
    out[instanceId] = { ok: true, data: projected };
  }

  return out;
}
