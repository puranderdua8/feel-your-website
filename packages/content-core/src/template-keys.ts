import type { TemplateKeyCatalog, TemplateKeyDefinition } from "./types.js";

/**
 * Declares the template vocabulary the CMS may compose from.
 *
 * Same shape and same reasoning as the permission catalog: code-defined and
 * closed within a project, because a template key only means something if the
 * UI kit exports a component for it. The CMS composes known templates; it
 * cannot invent new ones.
 *
 * The CMS validates against this **at publish time**, rejecting an unknown
 * key synchronously rather than discovering it as a render error later. That
 * is what makes "CMS changes go live without a deploy" safe: a published
 * bundle is already known-valid.
 */
export function defineTemplateKeys<const TDefinitions extends readonly TemplateKeyDefinition[]>(
  definitions: TDefinitions,
): TemplateKeyCatalog<TDefinitions[number]["name"]> {
  type TKey = TDefinitions[number]["name"];

  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const definition of definitions) {
    if (seen.has(definition.name)) duplicates.add(definition.name);
    seen.add(definition.name);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate template key(s): ${[...duplicates].sort().join(", ")}`);
  }

  return {
    definitions,
    values: definitions.map((d) => d.name) as readonly TKey[],
    includes: (value: string): value is TKey => seen.has(value),
  };
}

/** Extracts the key union from a template catalog. */
export type TemplateKeyOf<TCatalog> =
  TCatalog extends TemplateKeyCatalog<infer TKey> ? TKey : never;

/**
 * Validates a route bundle's items against the catalog, returning the unknown
 * keys. Empty means valid.
 *
 * Used by the CMS at publish time. Returns rather than throws so the editor
 * can show every bad key at once instead of one per save attempt.
 */
export function findUnknownTemplateKeys<TKey extends string>(
  catalog: TemplateKeyCatalog<TKey>,
  items: readonly string[],
): readonly string[] {
  return [...new Set(items.filter((item) => !catalog.includes(item)))].sort();
}
