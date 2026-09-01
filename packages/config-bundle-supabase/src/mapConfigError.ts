import {
  ConfigConflictError,
  ConfigStoreError,
  InvalidItemsError,
} from "@feel-your-website/config-schema";

/**
 * The Postgres-error shape `@supabase/supabase-js` surfaces from a failed
 * `.rpc()`/`.from()` call — a `PostgrestError`, structurally.
 */
interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Translates a failure from a Supabase config-bundle write or read into the
 * shared `ConfigStoreError` vocabulary.
 *
 * Unlike `mapContentError` in `content-adapter-supabase`, this one *does*
 * switch on `error.code` — and can, safely, because every code handled below
 * is one this package's own migrations raise on purpose
 * (`raise_bundle_conflict`'s `PT409`, `write_bundle_header`'s `PT404`, each
 * RPC's own `42501` permission check), not an incidental PostgREST code that
 * happens to be stable today. `mapContentError`'s reasoning about PostgREST
 * codes not being a contract still holds for anything *not* listed here,
 * which is why the fallback stays `unavailable`.
 */
export function mapConfigError(error: unknown, expectedVersionHint?: number): ConfigStoreError {
  const pg = error as PostgrestLikeError;

  if (pg?.code === "PT409") {
    const parsed = parseConflictDetail(pg.details);
    if (parsed) return new ConfigConflictError(parsed.expected, parsed.actual);
    // The detail failed to parse — should not happen since this package
    // controls both sides, but a version-less conflict is still a conflict,
    // and the caller's own hint beats claiming version 0.
    return new ConfigConflictError(expectedVersionHint ?? -1, -1);
  }

  if (pg?.code === "PT404") {
    return new ConfigStoreError("not_found", pg.message ?? "No config bundle with that id.", {
      cause: error,
    });
  }

  if (pg?.code === "42501") {
    return new ConfigStoreError(
      "forbidden",
      pg.message ?? "Not permitted to write this config bundle.",
      { cause: error },
    );
  }

  // The foreign-key guard on `role_permissions.permission` (see
  // `..._config_bundles.sql`) — unreachable through this store's own
  // `create`/`update`, which validate items against the vocabulary before
  // ever calling the RPC, but a defence in depth against anything that calls
  // the RPC directly. No item names can be recovered from a bare FK
  // violation, so this reports the failure without naming one.
  if (pg?.code === "23503") {
    return new InvalidItemsError([]);
  }

  // `config_bundles`' `unique (vocabulary, name)` and `route_bundles.path`'s
  // own `unique` (see `..._config_bundles.sql`) — a real input problem, not a
  // backend outage, and worth saying so: found by running this store's own
  // `live.test.ts` against a real database, where two tests reusing the same
  // literal path surfaced as the generic `unavailable` fallback below on
  // whichever ran second, naming neither the path nor the reason.
  if (pg?.code === "23505") {
    return new ConfigStoreError(
      "invalid_items",
      pg.message ?? "That name or path is already used by another bundle.",
      { cause: error },
    );
  }

  return new ConfigStoreError("unavailable", "The config bundle backend is unreachable.", {
    cause: error,
  });
}

function parseConflictDetail(details: string | null | undefined): {
  expected: number;
  actual: number;
} | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { expected?: unknown; actual?: unknown };
    if (typeof parsed.expected === "number" && typeof parsed.actual === "number") {
      return { expected: parsed.expected, actual: parsed.actual };
    }
  } catch {
    // Falls through to the caller's own fallback.
  }
  return null;
}
