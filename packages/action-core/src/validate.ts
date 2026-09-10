import type { FieldIssue, JsonValue, SectionDefinition } from "@feel-your-website/content-core";
import { validateSectionFields } from "@feel-your-website/content-core";

import type { ActionDefinition, ActionInputMapping, ActionInputSource } from "./types.js";

const INPUT_SOURCES = new Set<ActionInputSource>(["static", "routeParam", "formInput"]);

/**
 * Parses an authored input mapping — stored in the CMS as a JSON string on the
 * `actionBody` field — into an {@link ActionInputMapping}, or `null` if it is
 * not a well-formed one. An empty string is an empty mapping; an already-parsed
 * object is accepted too (forward-compatible with a structured control).
 *
 * Shared by the shell (building the authoritative request body) and the CMS
 * (publish-gating a `mode: "action"` button via {@link validateActionBinding}).
 */
export function parseActionInputMapping(raw: JsonValue): ActionInputMapping | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return {};
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const out: Record<string, { source: ActionInputSource; value: string }> = {};
  for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
    const record = entry as Record<string, unknown>;
    if (
      typeof record.source !== "string" ||
      !INPUT_SOURCES.has(record.source as ActionInputSource)
    ) {
      return null;
    }
    if (typeof record.value !== "string") return null;
    out[name] = { source: record.source as ActionInputSource, value: record.value };
  }
  return out;
}

/**
 * Checks a built request body against an action's input schema. Delegates to
 * `validateSectionFields` — `ActionInputSpec` is `SectionFieldSpec`, so the
 * required / number / boolean / select rules are exactly the same and only
 * need to be written once.
 */
export function validateActionInput(
  def: ActionDefinition,
  body: Readonly<Record<string, JsonValue>>,
): readonly FieldIssue[] {
  const asSection: SectionDefinition = {
    key: def.id,
    description: def.description,
    fields: def.input,
    slots: [],
  };
  return validateSectionFields(asSection, body);
}

/**
 * Checks an authored input mapping against an action, without running it:
 * every required input is mapped, every mapped name is a real input, every
 * source is allowed, every `routeParam` names a param the route actually has,
 * and — when `formInputNames` is supplied — every `formInput` names a field
 * the enclosing form actually has. Returns every problem so the editor can
 * show them together; `field` is the input name.
 *
 * `formInputNames` is optional: the shell (which rebuilds the body from
 * submitted values, then runs `validateActionInput`) omits it; the CMS passes
 * the sibling `field` names so a typo'd `formInput` mapping is caught at
 * publish rather than at click.
 */
export function validateActionBinding(
  def: ActionDefinition,
  mapping: ActionInputMapping,
  context: {
    readonly routeParamNames: readonly string[];
    readonly formInputNames?: readonly string[];
  },
): readonly FieldIssue[] {
  const issues: FieldIssue[] = [];
  const inputNames = new Set(def.input.map((spec) => spec.name));
  const allowed = new Set(def.allowedSources);
  const params = new Set(context.routeParamNames);
  const formFields = context.formInputNames ? new Set(context.formInputNames) : null;

  for (const spec of def.input) {
    if (spec.required && mapping[spec.name] === undefined) {
      issues.push({ field: spec.name, message: `${spec.label} is required but not mapped.` });
    }
  }

  for (const [name, entry] of Object.entries(mapping)) {
    const label = def.input.find((spec) => spec.name === name)?.label ?? name;

    if (!inputNames.has(name)) {
      issues.push({ field: name, message: `"${name}" is not an input of this action.` });
      continue;
    }
    if (!allowed.has(entry.source)) {
      issues.push({
        field: name,
        message: `${label} may not be filled from ${entry.source} (allowed: ${[...allowed].join(", ") || "none"}).`,
      });
      continue;
    }
    if (entry.value.trim() === "") {
      issues.push({ field: name, message: `${label} has no value.` });
      continue;
    }
    if (entry.source === "routeParam" && !params.has(entry.value)) {
      issues.push({
        field: name,
        message: `${label} maps to ":${entry.value}", which this route has no param for.`,
      });
    }
    if (entry.source === "formInput" && formFields && !formFields.has(entry.value)) {
      issues.push({
        field: name,
        message: `${label} maps to the form field "${entry.value}", which this form has no field for.`,
      });
    }
  }

  return issues;
}
