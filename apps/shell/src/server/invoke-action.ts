import type {
  ActionCatalog,
  ActionInvoker,
  ActionResult,
  MutationActionDefinition,
} from "@feel-your-website/action-core";
import { parseActionInputMapping, validateActionInput } from "@feel-your-website/action-core";
import { actionCatalog } from "@feel-your-website/action-registry";
import type { JsonValue, RouteBundle, RouteSectionNode } from "@feel-your-website/content-core";
import { flattenNodes } from "@feel-your-website/content-core";

import { buildActionBody } from "./build-action-body.js";
import { resolveRoutePage, type RoutePage } from "./resolve-route-page.js";
import { resolveRouteByKey } from "./route-content.js";

/** What a CTA click posts. `path` + `instanceId` let the server re-derive everything itself. */
export interface InvokeActionInput {
  /** The pathname the CTA is on — the server re-resolves it, never trusting a client tree. */
  readonly path: string;
  /** The `button` node that fired. */
  readonly instanceId: string;
  /** Per-submit id: an idempotent action replays the first result for a repeated id. */
  readonly requestId: string;
  /** Submitted form values (the form-input primitive is not built yet, so normally absent). */
  readonly formInput?: Readonly<Record<string, JsonValue>>;
}

interface RunInvokeDeps {
  readonly locale: string;
  readonly session: { readonly userId: string | null; readonly permissions: ReadonlySet<string> };
  readonly invoker: ActionInvoker;
  /** Defaults to the app catalog; injectable for tests. */
  readonly catalog?: ActionCatalog;
  /** Idempotency replay store, keyed by `actionId\0requestId`. Injectable for tests. */
  readonly replayCache?: Map<string, Promise<ActionResult>>;
}

export interface InvokeActionDeps extends RunInvokeDeps {
  readonly manifest: readonly RouteBundle[];
}

function findButtonNode(page: RoutePage, instanceId: string): RouteSectionNode | null {
  for (const layer of page.layers) {
    for (const node of flattenNodes(layer.tree)) {
      if (node.instanceId === instanceId && node.sectionKey === "button") return node;
    }
  }
  return null;
}

function findButtonNodeInTree(
  tree: readonly RouteSectionNode[],
  instanceId: string,
): RouteSectionNode | null {
  for (const node of flattenNodes(tree)) {
    if (node.instanceId === instanceId && node.sectionKey === "button") return node;
  }
  return null;
}

async function runInvoke(
  def: MutationActionDefinition,
  body: Record<string, JsonValue>,
  deps: RunInvokeDeps,
  requestId: string,
): Promise<ActionResult> {
  const result = await deps.invoker.invoke(def.id, body, {
    userId: deps.session.userId,
    requestId,
  });
  if (!result.ok) return result;
  if (def.parseResult) {
    const parsed = def.parseResult(result.data);
    if (parsed === null) return { ok: false, code: "invalid_response" };
    return { ok: true, data: parsed as JsonValue, stale: result.stale };
  }
  return result;
}

/**
 * The shared authoritative half, once the firing `button` node and its route's
 * params are in hand — everything both {@link resolveAndInvokeAction} and
 * {@link resolveAndInvokeActionByRouteKey} do identically: read the action id /
 * input mapping / RBAC requirement off the node's *published* content, rebuild
 * the request body from re-sanitised route params, validate, and invoke
 * (with idempotency replay). Never trusts the request for any of this beyond
 * `formInput` and `requestId`.
 */
async function invokeFromNode(
  node: RouteSectionNode,
  routeParams: Readonly<Record<string, string>>,
  input: { readonly requestId: string; readonly formInput?: Readonly<Record<string, JsonValue>> },
  deps: RunInvokeDeps,
): Promise<ActionResult> {
  const catalog = deps.catalog ?? actionCatalog;

  const fields = node.content[deps.locale] ?? {};
  if (fields.mode !== "action") return { ok: false, code: "not_found" };

  const actionId = typeof fields.actionId === "string" ? fields.actionId : "";
  const def = catalog.byId.get(actionId);
  if (!def || def.kind !== "mutation") return { ok: false, code: "not_found" };

  if (def.requiredPermission && !deps.session.permissions.has(def.requiredPermission)) {
    return { ok: false, code: "forbidden" };
  }

  const mapping = parseActionInputMapping(fields.body ?? null);
  if (!mapping) return { ok: false, code: "invalid_request" };

  const body = buildActionBody(def, mapping, { routeParams, formInput: input.formInput });

  const issues = validateActionInput(def, body);
  if (issues.length > 0) return { ok: false, code: "invalid_request", issues };

  if (def.idempotent && deps.replayCache) {
    const key = `${actionId}\0${input.requestId}`;
    const existing = deps.replayCache.get(key);
    if (existing) return existing;

    const pending = runInvoke(def, body, deps, input.requestId);
    deps.replayCache.set(key, pending);
    // A failed attempt should be retryable, so only a successful result is kept.
    void pending.then(
      (result) => {
        if (!result.ok) deps.replayCache!.delete(key);
      },
      () => deps.replayCache!.delete(key),
    );
    return pending;
  }

  return runInvoke(def, body, deps, input.requestId);
}

/**
 * The authoritative half of the `invokeAction` server fn — everything but
 * `assertSameOrigin()` and gathering the deps.
 *
 * The route is re-resolved from the published manifest, the firing node is
 * found by `instanceId`, and the action id, input mapping and RBAC requirement
 * are read from *published* content — never from the request. The body is
 * rebuilt by {@link buildActionBody} from re-sanitised route params. Expected
 * failures come back as an `ok: false` {@link ActionResult}, not a throw, and
 * never carry upstream text.
 */
export async function resolveAndInvokeAction(
  input: InvokeActionInput,
  deps: InvokeActionDeps,
): Promise<ActionResult> {
  const page = resolveRoutePage(input.path, deps.manifest, deps.locale);
  if (!page) return { ok: false, code: "not_found" };

  const node = findButtonNode(page, input.instanceId);
  if (!node) return { ok: false, code: "not_found" };

  return invokeFromNode(node, page.params, input, deps);
}

/**
 * What a CTA click posts under the bundle-scoped model (plan finding 3):
 * `routeKey` + `params` name the button's own route directly, instead of a
 * path the server would have to re-match. See `route-content.ts`'s doc
 * comment for why this is the model every route level now uses.
 */
export interface InvokeActionByKeyInput {
  readonly routeKey: string;
  readonly params: Readonly<Record<string, string>>;
  readonly instanceId: string;
  readonly requestId: string;
  readonly formInput?: Readonly<Record<string, JsonValue>>;
}

export interface InvokeActionByKeyDeps extends RunInvokeDeps {
  /** `getContentAdapter().getRouteByKey(input.routeKey)`'s result — `undefined` if unpublished/unknown. */
  readonly bundle: RouteBundle | undefined;
}

/**
 * The bundle-scoped counterpart to {@link resolveAndInvokeAction}: the bundle
 * is looked up directly by `routeKey` (never re-matched from a path), params
 * are validated against *that bundle's own* `paramNames`, and the firing node
 * is searched for only in that bundle's own tree — a button belongs to
 * whichever bundle authored it, never an ancestor's or a descendant's.
 */
export async function resolveAndInvokeActionByRouteKey(
  input: InvokeActionByKeyInput,
  deps: InvokeActionByKeyDeps,
): Promise<ActionResult> {
  const resolved = resolveRouteByKey(deps.bundle, deps.locale, input.params);
  if (resolved === "not_found" || resolved === "invalid_params") {
    return { ok: false, code: "not_found" };
  }

  const node = findButtonNodeInTree(resolved.bundle.tree, input.instanceId);
  if (!node) return { ok: false, code: "not_found" };

  return invokeFromNode(node, resolved.params, input, deps);
}
