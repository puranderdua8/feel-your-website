/**
 * Reads and validates the shell's registered-actions configuration from the
 * environment. Kept out of `adapters.ts` so it stays free of the concrete
 * invoker package (the seam test) — `adapters.ts` turns `rawBindings` into
 * `HttpActionBindings` and constructs the invoker.
 *
 * A malformed value fails here, at first read, naming the variable — the same
 * discipline as `requireEnv`.
 */

export type ActionInvokerKind = "none" | "memory" | "http";
export type ActionCacheKind = "memory" | "blobs";

export interface ActionConfig {
  readonly kind: ActionInvokerKind;
  readonly cache: ActionCacheKind;
  /** The decoded `ACTION_CONFIG` JSON. `{}` unless `kind === "http"`. */
  readonly rawBindings: unknown;
  /** Hosts every binding's URL must resolve to. Empty unless `kind === "http"`. */
  readonly hostAllowlist: readonly string[];
  /** Hosts to which `forwardUserAuth` is permitted. */
  readonly firstPartyHosts: readonly string[];
}

type Env = Record<string, string | undefined>;

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadActionConfig(env: Env = process.env): ActionConfig {
  const kind = env.ACTION_INVOKER ?? "none";
  if (kind !== "none" && kind !== "memory" && kind !== "http") {
    throw new Error(`Unknown ACTION_INVOKER "${kind}". Expected "none", "memory" or "http".`);
  }

  const cache = env.ACTION_CACHE ?? "memory";
  if (cache !== "memory" && cache !== "blobs") {
    throw new Error(`Unknown ACTION_CACHE "${cache}". Expected "memory" or "blobs".`);
  }

  let rawBindings: unknown = {};
  let hostAllowlist: readonly string[] = [];
  let firstPartyHosts: readonly string[] = [];

  if (kind === "http") {
    if (!env.ACTION_CONFIG) {
      throw new Error('ACTION_CONFIG is required when ACTION_INVOKER="http".');
    }
    try {
      rawBindings = JSON.parse(env.ACTION_CONFIG);
    } catch {
      throw new Error("ACTION_CONFIG is not valid JSON.");
    }

    hostAllowlist = splitList(env.ACTION_HOST_ALLOWLIST);
    if (hostAllowlist.length === 0) {
      throw new Error('ACTION_HOST_ALLOWLIST is required when ACTION_INVOKER="http".');
    }
    firstPartyHosts = splitList(env.ACTION_FIRST_PARTY_HOSTS);
  }

  return { kind, cache, rawBindings, hostAllowlist, firstPartyHosts };
}
