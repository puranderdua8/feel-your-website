export type ConfigErrorCode =
  | "not_found"
  /** Items failed validation against the vocabulary. */
  | "invalid_items"
  /** Another writer changed the bundle first. */
  | "conflict"
  | "unavailable"
  | "timeout";

export class ConfigStoreError extends Error {
  readonly code: ConfigErrorCode;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(code: ConfigErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "ConfigStoreError";
    this.code = code;
    this.retryable = code === "unavailable" || code === "timeout";
    this.cause = options.cause;
  }
}

/**
 * Thrown when a write is based on a stale read.
 *
 * Carries both versions so the CMS can say "someone else changed this while
 * you were editing" and offer to reload, rather than silently overwriting.
 */
export class ConfigConflictError extends ConfigStoreError {
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      "conflict",
      `Bundle was modified by someone else (expected version ${expectedVersion}, found ${actualVersion}).`,
    );
    this.name = "ConfigConflictError";
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/** Thrown when items are not all drawn from the fixed vocabulary. */
export class InvalidItemsError extends ConfigStoreError {
  readonly unknownItems: readonly string[];

  constructor(unknownItems: readonly string[]) {
    super("invalid_items", `Unknown item(s) for this vocabulary: ${unknownItems.join(", ")}`);
    this.name = "InvalidItemsError";
    this.unknownItems = unknownItems;
  }
}

export function isConfigStoreError(error: unknown): error is ConfigStoreError {
  return error instanceof ConfigStoreError;
}
