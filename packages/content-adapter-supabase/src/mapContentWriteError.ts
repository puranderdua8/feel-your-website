import { ContentAdapterError } from "@feel-your-website/content-core";

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * Translates a failure from a `ContentWriter` call into `ContentAdapterError`.
 *
 * Separate from `mapContentError` (see that function's own doc on why a plain
 * read never switches on `error.code`): the write RPCs
 * (`..._content_writes.sql`) raise exactly one code on purpose —
 * `42501` when `has_permission('manage:content')` fails — which is safe to
 * switch on for the same reason `mapConfigError` in
 * `@feel-your-website/config-bundle-supabase` is: this package's own
 * migration raises it, not an incidental PostgREST code that merely happens
 * to be stable today.
 */
export function mapContentWriteError(error: unknown): ContentAdapterError {
  const pg = error as PostgrestLikeError;

  if (pg?.code === "42501") {
    return new ContentAdapterError("forbidden", pg.message ?? "manage:content is required.", {
      cause: error,
    });
  }

  return new ContentAdapterError("unavailable", "The content backend is unreachable.", {
    cause: error,
  });
}
