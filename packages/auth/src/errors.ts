/**
 * The failure vocabulary every AuthProvider must speak, for the same reason
 * ContentAdapter has one: substitutability is about behaviour on the unhappy
 * path, not just method signatures.
 */
export type AuthErrorCode =
  /** Credentials were rejected. Not retryable — retrying sends the same wrong password. */
  | "invalid_credentials"
  /** A session existed but is no longer valid. Not retryable; sign in again. */
  | "session_expired"
  /** The provider could not be reached, or returned 5xx. Retryable. */
  | "unavailable"
  /** The request exceeded the provider's timeout budget. Retryable. */
  | "timeout";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly retryable: boolean;
  /** The underlying vendor error, for logs only. Never rendered. */
  readonly cause?: unknown;

  constructor(code: AuthErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.retryable = code === "unavailable" || code === "timeout";
    this.cause = options.cause;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Never say which half was wrong.
 *
 * "No account with that email" tells an attacker the email is unregistered,
 * turning the sign-in form into an account-enumeration oracle. Every
 * credential rejection uses this one message.
 */
export const INVALID_CREDENTIALS_MESSAGE = "Incorrect email or password.";
