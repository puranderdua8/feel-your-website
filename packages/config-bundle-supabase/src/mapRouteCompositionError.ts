import {
  RouteCompositionConflictError,
  RouteCompositionError,
} from "@feel-your-website/content-core";

/**
 * The Postgres-error shape `@supabase/supabase-js` surfaces from a failed
 * `.rpc()` call — a `PostgrestError`, structurally.
 */
interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/**
 * Translates a failure from `save_route_composition` into the
 * `RouteCompositionError` vocabulary.
 *
 * Every code switched on here is one this repo's own migrations raise on
 * purpose — `raise_bundle_conflict`'s `PT409`, `write_bundle_header`'s
 * `PT404`, the RPC's own `42501` — so switching on `error.code` is safe here
 * in a way it would not be for an incidental PostgREST code. Anything else
 * falls through to `unavailable`, same as `mapConfigError`.
 */
export function mapRouteCompositionError(
  error: unknown,
  expectedVersionHint?: number | null,
): RouteCompositionError {
  const pg = error as PostgrestLikeError;

  if (pg?.code === "PT409") {
    const parsed = parseConflictDetail(pg.details);
    if (parsed) return new RouteCompositionConflictError(parsed.expected, parsed.actual);
    return new RouteCompositionConflictError(expectedVersionHint ?? -1, -1);
  }

  if (pg?.code === "PT404") {
    return new RouteCompositionError("not_found", pg.message ?? "No route bundle with that id.", {
      cause: error,
    });
  }

  if (pg?.code === "42501") {
    return new RouteCompositionError(
      "forbidden",
      pg.message ?? "Not permitted to write this route bundle.",
      { cause: error },
    );
  }

  return new RouteCompositionError("unavailable", "The route bundle backend is unreachable.", {
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
