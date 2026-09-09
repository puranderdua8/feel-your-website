/**
 * Tiny typed guards for turning untrusted JSON (an external API response, a
 * stored blob) into a known shape — or `null`.
 *
 * Not a schema library and not trying to be one: no error messages, no
 * coercion, no async, no codegen. The whole point is that a hand-written
 * `parseResult` stays short and readable while still narrowing precisely, so
 * a loose parser can't silently ship `any`-shaped data to a component.
 *
 * Usage:
 *
 * ```ts
 * function parseReleases(raw: JsonValue): Release[] | null {
 *   return parse(
 *     raw,
 *     arrayOf(
 *       (v): v is Release =>
 *         field(v, "title", isString) !== null &&
 *         field(v, "url", isString) !== null,
 *     ),
 *   );
 * }
 * ```
 */

/** A type predicate over `unknown`. */
export type Guard<T> = (value: unknown) => value is T;

export const isString: Guard<string> = (value): value is string => typeof value === "string";

/** `true` only for a finite number — `NaN` and `±Infinity` do not pass. */
export const isNumber: Guard<number> = (value): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const isBoolean: Guard<boolean> = (value): value is boolean => typeof value === "boolean";

/** A non-null, non-array object. */
export const isObject: Guard<Record<string, unknown>> = (value): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Guard for an array whose every element passes `item`. An empty array passes. */
export function arrayOf<T>(item: Guard<T>): Guard<T[]> {
  return (value): value is T[] => Array.isArray(value) && value.every((element) => item(element));
}

/** Guard for a record whose every value passes `value`. An empty object passes. */
export function objectOf<T>(value: Guard<T>): Guard<Record<string, T>> {
  return (candidate): candidate is Record<string, T> =>
    isObject(candidate) && Object.values(candidate).every((entry) => value(entry));
}

/**
 * Read one field of an unknown value through a guard.
 *
 * Returns the narrowed field, or `null` when `object` is not an object or the
 * field is missing / fails the guard. Because `null` is also a legitimate
 * value, use {@link isObject} + a direct check when you must distinguish
 * "absent" from "present but null".
 */
export function field<T>(object: unknown, key: string, guard: Guard<T>): T | null {
  if (!isObject(object)) return null;
  const value = object[key];
  return guard(value) ? value : null;
}

/** `guard(value)` ? `value` : `null` — the parse-or-null idiom, named. */
export function parse<T>(value: unknown, guard: Guard<T>): T | null {
  return guard(value) ? value : null;
}
