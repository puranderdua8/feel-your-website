import { ContentAdapterError } from "@feel-your-website/content-core";

/**
 * Translates any failure from a Supabase content read into the shared
 * `ContentAdapterError` vocabulary.
 *
 * Always `"unavailable"`, deliberately without a per-code switch. This
 * adapter's own code fully controls query shape — locale, cursor, limit are
 * all validated before a request is built (`#decodeCursor` raises
 * `invalid_request` directly, never through here) — so anything that reaches
 * this function means a reachable backend rejected a request this adapter
 * believed was well-formed. That is what "unavailable" means: retryable,
 * pending a specific case that turns out to need finer handling.
 *
 * Unlike `mapAuthError` in `@feel-your-website/auth-supabase`, there is no
 * stable, documented code enum to switch on here: GoTrue publishes one for
 * auth failures; PostgREST's `error.code` is a raw Postgres SQLSTATE or a
 * `PGRST*` code, meaningful for logs, not a contract to branch behaviour on.
 */
export function mapContentError(error: unknown): ContentAdapterError {
  return new ContentAdapterError("unavailable", "The content backend is unreachable.", {
    cause: error,
  });
}
