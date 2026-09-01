import { AuthError, INVALID_CREDENTIALS_MESSAGE } from "@feel-your-website/auth";
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

/**
 * Translates a GoTrue error into the shared `AuthError` vocabulary.
 *
 * Branches on `error.code` — the stable, documented identifier GoTrue
 * exposes — never on `error.message`, which is prose meant for a UI and is
 * not a stable contract to switch on.
 *
 * `session_not_found` / `refresh_token_not_found` / `refresh_token_already_used`
 * all become `session_expired`: from the caller's side they mean the same
 * thing (sign in again), and the distinctions between them are only
 * meaningful for a support engineer reading `cause`.
 */
export function mapAuthError(error: unknown): AuthError {
  if (isAuthRetryableFetchError(error)) {
    return new AuthError("unavailable", "The authentication service is unreachable.", {
      cause: error,
    });
  }

  if (isAuthSessionMissingError(error)) {
    return new AuthError("session_expired", "Session is no longer valid.", { cause: error });
  }

  if (isAuthApiError(error)) {
    switch (error.code) {
      case "invalid_credentials":
        // The one message every credential rejection uses, regardless of
        // which half was wrong — see errors.ts on why.
        return new AuthError("invalid_credentials", INVALID_CREDENTIALS_MESSAGE, {
          cause: error,
        });
      case "session_expired":
      case "session_not_found":
      case "refresh_token_not_found":
      case "refresh_token_already_used":
        return new AuthError("session_expired", "Session is no longer valid.", { cause: error });
      case "request_timeout":
      case "hook_timeout":
      case "hook_timeout_after_retry":
        return new AuthError("timeout", "The authentication request timed out.", {
          cause: error,
        });
    }

    // Any other 5xx from the Auth server is the same "try again later" as a
    // network failure to a caller; only >= 500 is treated this way; a 4xx
    // this switch didn't already name is a code the app hasn't accounted
    // for, and is not safe to guess retryable.
    if (error.status !== undefined && error.status >= 500) {
      return new AuthError("unavailable", "The authentication service is unreachable.", {
        cause: error,
      });
    }
  }

  return new AuthError("unavailable", "The authentication service is unreachable.", {
    cause: error,
  });
}
