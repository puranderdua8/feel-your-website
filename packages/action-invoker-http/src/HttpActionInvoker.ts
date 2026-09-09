import type {
  ActionCatalog,
  ActionContext,
  ActionDefinition,
  ActionErrorCode,
  ActionInvoker,
  ActionResult,
} from "@feel-your-website/action-core";
import { ACTION_TIMEOUT_MS } from "@feel-your-website/action-core";
import type { JsonValue } from "@feel-your-website/content-core";

import { assertBindings, type HttpActionBinding, type HttpActionBindings } from "./bindings.js";

type JsonBody = Readonly<Record<string, JsonValue>>;

export interface HttpActionInvokerOptions {
  readonly catalog: ActionCatalog;
  readonly bindings: HttpActionBindings;
  readonly hostAllowlist: readonly string[];
  readonly firstPartyHosts?: readonly string[];
  /** Injectable for tests. Defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Injectable for tests. Defaults to `process.env` lookup. */
  readonly readEnv?: (name: string) => string | undefined;
}

/** Maps an upstream HTTP status to an {@link ActionErrorCode}. */
function statusToCode(status: number): ActionErrorCode {
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

/**
 * The production {@link ActionInvoker}. Resolves an action to its
 * env-configured upstream, places the already-built body per the binding,
 * applies a per-call timeout, and returns a normalised {@link ActionResult}.
 * It never throws for an expected failure and never puts upstream response
 * text into the result.
 */
export class HttpActionInvoker implements ActionInvoker {
  readonly #catalog: ActionCatalog;
  readonly #bindings: HttpActionBindings;
  readonly #fetch: typeof fetch;
  readonly #readEnv: (name: string) => string | undefined;
  readonly #resolvedHeaders: Map<string, Record<string, string>>;

  constructor(options: HttpActionInvokerOptions) {
    this.#catalog = options.catalog;
    this.#bindings = options.bindings;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#readEnv = options.readEnv ?? ((name) => process.env[name]);

    assertBindings(this.#catalog, this.#bindings, {
      hostAllowlist: options.hostAllowlist,
      firstPartyHosts: options.firstPartyHosts,
      readEnv: this.#readEnv,
    });

    // Resolve `headersFromEnv` once — `assertBindings` has already proven each var is set.
    this.#resolvedHeaders = new Map();
    for (const [id, binding] of Object.entries(this.#bindings)) {
      const headers: Record<string, string> = { ...(binding.headers ?? {}) };
      for (const [header, envName] of Object.entries(binding.headersFromEnv ?? {})) {
        headers[header] = this.#readEnv(envName) as string;
      }
      this.#resolvedHeaders.set(id, headers);
    }
  }

  async invoke(actionId: string, body: JsonBody, context: ActionContext): Promise<ActionResult> {
    const def = this.#catalog.byId.get(actionId);
    const binding = this.#bindings[actionId];
    if (!def || !binding) return { ok: false, code: "not_found" };

    const request = this.#buildRequest(def, binding, body, context);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), binding.timeoutMs ?? ACTION_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    context.signal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await this.#fetch(request.url, {
        method: binding.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });

      if (!response.ok) return { ok: false, code: statusToCode(response.status) };

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return { ok: false, code: "invalid_response" };
      }
      const data = (await response.json()) as JsonValue;
      return { ok: true, data };
    } catch {
      return { ok: false, code: controller.signal.aborted ? "timeout" : "unavailable" };
    } finally {
      clearTimeout(timeout);
      context.signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  #buildRequest(
    def: ActionDefinition,
    binding: HttpActionBinding,
    body: JsonBody,
    context: ActionContext,
  ): { url: string; headers: Record<string, string>; body?: string } {
    const allowed = new Set(binding.allowedParams);
    const used = new Set<string>();

    // Path placeholders first.
    const path = binding.urlTemplate.replace(/:([A-Za-z0-9_]+)/g, (match, name: string) => {
      if (!allowed.has(name) || body[name] === undefined) return match;
      used.add(name);
      return encodeURIComponent(String(body[name]));
    });

    const url = new URL(path);
    const place =
      binding.apply ?? (def.method === "GET" || def.method === "HEAD" ? "query" : "body");

    const rest: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!allowed.has(key) || used.has(key) || value === undefined) continue;
      if (place === "query") url.searchParams.set(key, String(value));
      else rest[key] = value;
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(this.#resolvedHeaders.get(def.id) ?? {}),
    };

    if (
      def.kind === "mutation" &&
      def.idempotent &&
      binding.idempotencyHeader &&
      context.requestId
    ) {
      headers[binding.idempotencyHeader] = context.requestId;
    }
    if (binding.forwardUserAuth && context.userToken) {
      headers.Authorization = `Bearer ${context.userToken}`;
    }

    if (place === "body" && Object.keys(rest).length > 0) {
      headers["Content-Type"] = "application/json";
      return { url: url.toString(), headers, body: JSON.stringify(rest) };
    }
    return { url: url.toString(), headers };
  }
}
