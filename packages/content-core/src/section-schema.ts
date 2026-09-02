import type { JsonValue } from "./types.js";

/**
 * The schema half of a section: what fields an author fills in, and what
 * slots other sections can be dropped into.
 *
 * Same reasoning as `defineTemplateKeys` — code-defined and closed within a
 * project, because a section only means something if the UI kit exports a
 * component for it. But where a template key is just `{ name, description }`,
 * a section also declares the *shape* of its content, so the CMS can render
 * a real form instead of a JSON textarea, and the *slots* that make it
 * composable.
 */

export type SectionFieldType =
  | "text" // single-line string
  | "richtext" // multi-line string
  | "image" // URL string; the CMS shows a thumbnail
  | "url" // URL string (links, CTAs)
  | "number"
  | "boolean"
  | "select" // string constrained to `options`
  | "icon"; // string: a lucide-react icon name

export interface SectionFieldSpec {
  /** Key inside `Content.fields`, e.g. `"title"`. */
  readonly name: string;
  /** Shown as the form control's label. */
  readonly label: string;
  readonly type: SectionFieldType;
  /** Must be present and non-empty for the section to be publish-complete. */
  readonly required?: boolean;
  /** Only meaningful for `type: "select"`. */
  readonly options?: readonly string[];
  /** Pre-fills a newly created content variant. */
  readonly default?: JsonValue;
  readonly helpText?: string;
}

export interface SectionSlotSpec {
  /** Slot name, e.g. `"icon"`, `"body"`. */
  readonly name: string;
  readonly label: string;
  /** Section keys allowed in this slot. Empty = any section. */
  readonly accepts: readonly string[];
  readonly arity: "single" | "list";
  /** Must be filled for the route to be publish-complete. */
  readonly required?: boolean;
}

/**
 * A stand-in child for previewing a composite section's slot — just a section
 * key and the fields to render it with. Recursive so a `card` sample can put
 * a `text` inside a `body` slot that itself nests, but in practice one level
 * is enough.
 */
export interface SectionSampleChild {
  readonly sectionKey: string;
  readonly fields: Readonly<Record<string, JsonValue>>;
  readonly slots?: Readonly<Record<string, readonly SectionSampleChild[]>>;
}

/**
 * Dummy content for showing a section on its own — the CMS "Sections" gallery
 * renders each catalog entry with this. Never persisted, never a publish
 * default: it exists only so an author can see what a component looks like
 * before placing it on a route, where the route then supplies the real
 * content.
 */
export interface SectionSample {
  readonly fields: Readonly<Record<string, JsonValue>>;
  /** Stand-in children per slot, so a composite renders filled, not empty. */
  readonly slots?: Readonly<Record<string, readonly SectionSampleChild[]>>;
}

export interface SectionDefinition {
  /** e.g. `"hero"`, `"card"`, `"icon"`. */
  readonly key: string;
  readonly description: string;
  readonly fields: readonly SectionFieldSpec[];
  /** `[]` for a leaf/atom section. */
  readonly slots: readonly SectionSlotSpec[];
  /**
   * Dummy content for the Sections gallery. Optional so bare test catalogs
   * need not supply it; every real catalog section should.
   */
  readonly sample?: SectionSample;
}

export interface SectionCatalog {
  readonly definitions: readonly SectionDefinition[];
  readonly byKey: ReadonlyMap<string, SectionDefinition>;
  readonly values: readonly string[];
  readonly includes: (value: string) => boolean;
}

/**
 * Builds a {@link SectionCatalog}, rejecting a duplicated `key` the same way
 * `defineTemplateKeys` rejects a duplicated name — a duplicate is a
 * programming error in the catalog, caught at module load.
 */
export function defineSections(definitions: readonly SectionDefinition[]): SectionCatalog {
  const byKey = new Map<string, SectionDefinition>();
  const duplicates = new Set<string>();

  for (const definition of definitions) {
    if (byKey.has(definition.key)) duplicates.add(definition.key);
    byKey.set(definition.key, definition);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate section key(s): ${[...duplicates].sort().join(", ")}`);
  }

  return {
    definitions,
    byKey,
    values: definitions.map((d) => d.key),
    includes: (value: string): boolean => byKey.has(value),
  };
}

export interface FieldIssue {
  readonly field: string;
  readonly message: string;
}

/**
 * Checks a section's `fields` payload against its schema: required fields
 * present and non-empty, `select` values within `options`, `number` and
 * `boolean` well-typed. Returns every problem rather than throwing on the
 * first, so the editor can show them all at once.
 */
export function validateSectionFields(
  def: SectionDefinition,
  fields: Readonly<Record<string, JsonValue>>,
): readonly FieldIssue[] {
  const issues: FieldIssue[] = [];

  for (const spec of def.fields) {
    const value = fields[spec.name];
    const missing =
      value === undefined || value === null || (typeof value === "string" && value.trim() === "");

    if (spec.required && missing) {
      issues.push({ field: spec.name, message: `${spec.label} is required.` });
      continue;
    }
    if (missing) continue;

    switch (spec.type) {
      case "number":
        if (typeof value !== "number") {
          issues.push({ field: spec.name, message: `${spec.label} must be a number.` });
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          issues.push({ field: spec.name, message: `${spec.label} must be true or false.` });
        }
        break;
      case "select":
        if (typeof value !== "string" || !(spec.options ?? []).includes(value)) {
          issues.push({
            field: spec.name,
            message: `${spec.label} must be one of: ${(spec.options ?? []).join(", ")}.`,
          });
        }
        break;
      default:
        if (typeof value !== "string") {
          issues.push({ field: spec.name, message: `${spec.label} must be text.` });
        }
    }
  }

  return issues;
}

/**
 * The keys among `keys` not in the catalog, de-duplicated and sorted. Empty
 * means every key names a real section. The CMS calls this at publish time
 * with a route's flattened section-key list.
 */
export function findUnknownSectionKeys(
  catalog: SectionCatalog,
  keys: readonly string[],
): readonly string[] {
  return [...new Set(keys.filter((key) => !catalog.includes(key)))].sort();
}
