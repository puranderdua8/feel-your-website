import type { ActionCatalog } from "@feel-your-website/action-core";

/**
 * The server-only half of a registered action: where its upstream lives and
 * how to talk to it. Kept entirely out of the catalog and out of any CMS —
 * a binding is set from environment config, never authored.
 */
export interface HttpActionBinding {
  /** Absolute URL, with `:name` placeholders filled from same-named inputs. */
  readonly urlTemplate: string;
  /** Must equal the action's `method`. */
  readonly method: string;
  /**
   * Where non-path inputs go. Defaults to `query` for GET/HEAD, `body`
   * otherwise. Path placeholders are always filled regardless.
   */
  readonly apply?: "query" | "body";
  /** Input names permitted into the URL / query / body. Anything else is dropped. */
  readonly allowedParams: readonly string[];
  /** Static request headers. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Header name → env var name. The value is read at construction; a missing var fails the boot. */
  readonly headersFromEnv?: Readonly<Record<string, string>>;
  /** Forward the caller's session token as `Authorization: Bearer …`. First-party hosts only. */
  readonly forwardUserAuth?: boolean;
  /** Per-call timeout override (ms). */
  readonly timeoutMs?: number;
  /** For an idempotent mutation: forward `context.requestId` under this header. */
  readonly idempotencyHeader?: string;
  /** Asserted to equal `new URL(resolvedUrl).host` — guards a mistyped template. */
  readonly allowedHost: string;
}

export type HttpActionBindings = Readonly<Record<string, HttpActionBinding>>;

function fail(message: string): never {
  throw new Error(`Invalid action binding: ${message}`);
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string" || value === "") fail(`${where} must be a non-empty string.`);
  return value as string;
}

function asStringArray(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    fail(`${where} must be an array of strings.`);
  }
  return value as string[];
}

function asStringRecord(value: unknown, where: string): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${where} must be an object of strings.`);
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string") fail(`${where}.${key} must be a string.`);
    out[key] = entry;
  }
  return out;
}

/**
 * Parses an untrusted value (a decoded `ACTION_CONFIG` blob) into
 * {@link HttpActionBindings}, throwing a named error on the first problem.
 * Does not check the bindings against a catalog — that is
 * {@link assertBindings}.
 */
export function parseHttpActionBindings(raw: unknown): HttpActionBindings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    fail("expected an object keyed by action id.");
  }

  const out: Record<string, HttpActionBinding> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      fail(`"${id}" must be an object.`);
    }
    const b = value as Record<string, unknown>;

    const apply = b.apply === undefined ? undefined : b.apply;
    if (apply !== undefined && apply !== "query" && apply !== "body") {
      fail(`"${id}".apply must be "query" or "body".`);
    }

    out[id] = {
      urlTemplate: asString(b.urlTemplate, `"${id}".urlTemplate`),
      method: asString(b.method, `"${id}".method`).toUpperCase(),
      apply,
      allowedParams: asStringArray(b.allowedParams ?? [], `"${id}".allowedParams`),
      headers: b.headers === undefined ? undefined : asStringRecord(b.headers, `"${id}".headers`),
      headersFromEnv:
        b.headersFromEnv === undefined
          ? undefined
          : asStringRecord(b.headersFromEnv, `"${id}".headersFromEnv`),
      forwardUserAuth: b.forwardUserAuth === true,
      timeoutMs: typeof b.timeoutMs === "number" ? b.timeoutMs : undefined,
      idempotencyHeader:
        b.idempotencyHeader === undefined
          ? undefined
          : asString(b.idempotencyHeader, `"${id}".idempotencyHeader`),
      allowedHost: asString(b.allowedHost, `"${id}".allowedHost`),
    };
  }
  return out;
}

export interface AssertBindingsContext {
  /** Every binding's host must be in this list. */
  readonly hostAllowlist: readonly string[];
  /** Hosts to which forwarding the user's session token is permitted. */
  readonly firstPartyHosts?: readonly string[];
  /** Env reader, for checking `headersFromEnv` vars resolve. Defaults to `process.env`. */
  readonly readEnv?: (name: string) => string | undefined;
}

/**
 * Boot-time assertion: every catalog action has exactly one binding, methods
 * agree, every host is allow-listed and matches `allowedHost`, every
 * `headersFromEnv` var is set, and `forwardUserAuth` is only used against a
 * first-party host. Throws on the first violation — a broken deploy should
 * fail loudly here, not serve odd results later.
 */
export function assertBindings(
  catalog: ActionCatalog,
  bindings: HttpActionBindings,
  context: AssertBindingsContext,
): void {
  const readEnv = context.readEnv ?? ((name) => process.env[name]);
  const hostAllowlist = new Set(context.hostAllowlist);
  const firstParty = new Set(context.firstPartyHosts ?? []);

  const boundIds = new Set(Object.keys(bindings));
  for (const id of catalog.values) {
    if (!boundIds.has(id)) fail(`action "${id}" has no binding.`);
  }
  for (const id of boundIds) {
    if (!catalog.includes(id)) fail(`binding "${id}" names no action in the catalog.`);
  }

  for (const [id, binding] of Object.entries(bindings)) {
    const def = catalog.byId.get(id);
    if (def && binding.method !== def.method) {
      fail(`"${id}".method is ${binding.method} but the action's method is ${def.method}.`);
    }

    let host: string;
    try {
      host = new URL(binding.urlTemplate.replace(/:[A-Za-z0-9_]+/g, "x")).host;
    } catch {
      fail(`"${id}".urlTemplate is not a valid URL.`);
    }
    if (host !== binding.allowedHost) {
      fail(`"${id}".urlTemplate host ${host} does not match allowedHost ${binding.allowedHost}.`);
    }
    if (!hostAllowlist.has(host)) {
      fail(`"${id}" host ${host} is not in the action host allowlist.`);
    }
    if (binding.forwardUserAuth && !firstParty.has(host)) {
      fail(`"${id}" sets forwardUserAuth but ${host} is not a first-party host.`);
    }
    for (const [header, envName] of Object.entries(binding.headersFromEnv ?? {})) {
      if (!readEnv(envName)) {
        fail(`"${id}".headersFromEnv.${header} reads ${envName}, which is not set.`);
      }
    }
  }
}
