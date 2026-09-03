/**
 * The error vocabulary every adapter must speak.
 *
 * Matching method signatures is not enough for real substitutability: if one
 * adapter throws a `PostgrestError` and another returns `null`, every call
 * site has to know which adapter it is talking to, and the seam leaks. So
 * failure is part of the contract, not an implementation detail.
 */
export type ContentErrorCode =
  /** The backend was reachable but the request was malformed. Not retryable. */
  | "invalid_request"
  /** The caller is not permitted to read this. Not retryable. */
  | "forbidden"
  /** The backend could not be reached, or returned 5xx. Retryable. */
  | "unavailable"
  /** The request exceeded the adapter's timeout budget. Retryable. */
  | "timeout";

export class ContentAdapterError extends Error {
  readonly code: ContentErrorCode;
  /** Whether a caller may sensibly retry. Drives UI retry affordances. */
  readonly retryable: boolean;
  /** The underlying vendor error, for logging only. Never rendered. */
  readonly cause?: unknown;

  constructor(code: ContentErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "ContentAdapterError";
    this.code = code;
    this.retryable = code === "unavailable" || code === "timeout";
    this.cause = options.cause;
  }
}

export function isContentAdapterError(error: unknown): error is ContentAdapterError {
  return error instanceof ContentAdapterError;
}

/**
 * The timeout every adapter is expected to honour, in milliseconds.
 *
 * Stated as a contract value rather than left to each implementation because
 * the UI's loading states are built against it: a skeleton that gives up at
 * 5s is wrong if an adapter can block for 30.
 */
export const CONTENT_TIMEOUT_MS = 5_000;

/**
 * Failure vocabulary for {@link RouteCompositionWriter}.
 *
 * Its own type rather than reusing `config-schema`'s `ConfigStoreError` — a
 * route composition is written through a narrow, purpose-built seam, and
 * `content-core` stays free of a dependency on `config-schema` (mirrors how
 * this package owns `ContentAdapterError` for the read side).
 */
export type RouteCompositionErrorCode =
  /** No route bundle with the given id. */
  | "not_found"
  /** The `expectedVersion` did not match — someone else wrote first. */
  | "conflict"
  /** The caller lacks `manage:routes`. */
  | "forbidden"
  /**
   * The write is structurally rejected: a parent cycle, a child published under
   * a draft parent (or a parent unpublished while a child is live), a delete of
   * a route that still has children, a reserved path, or a colliding path
   * pattern. Not retryable — the author must change the request.
   */
  | "invalid"
  /** The backend could not be reached. Retryable. */
  | "unavailable";

export class RouteCompositionError extends Error {
  readonly code: RouteCompositionErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(code: RouteCompositionErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "RouteCompositionError";
    this.code = code;
    this.retryable = code === "unavailable";
    this.cause = options.cause;
  }
}

/** Raised when a save states a version other than the one on record. */
export class RouteCompositionConflictError extends RouteCompositionError {
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      "conflict",
      `Route composition version conflict: expected ${expectedVersion}, found ${actualVersion}.`,
    );
    this.name = "RouteCompositionConflictError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export function isRouteCompositionError(error: unknown): error is RouteCompositionError {
  return error instanceof RouteCompositionError;
}
