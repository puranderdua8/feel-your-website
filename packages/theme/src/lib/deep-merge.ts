type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively merges plain objects left-to-right; later sources win on
 * conflicting leaf values. Arrays and non-plain-object values are replaced,
 * not merged. Used to layer theme configs (base → named theme → consumer
 * overrides) on top of one another.
 */
export function deepMerge<T extends PlainObject>(...sources: Array<Partial<T> | undefined>): T {
  const result: PlainObject = {};

  for (const source of sources) {
    if (!source) continue;

    for (const [key, value] of Object.entries(source)) {
      const existing = result[key];
      if (isPlainObject(existing) && isPlainObject(value)) {
        result[key] = deepMerge(existing, value);
      } else {
        result[key] = value;
      }
    }
  }

  return result as T;
}
