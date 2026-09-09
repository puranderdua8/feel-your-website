import type { FieldIssue, JsonValue, SectionDefinition } from "@feel-your-website/content-core";
import { validateSectionFields } from "@feel-your-website/content-core";

import type { ActionDefinition, ActionInputMapping } from "./types.js";

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
 * source is allowed, and every `routeParam` names a param the route actually
 * has. Returns every problem so the editor can show them together;
 * `field` is the input name.
 */
export function validateActionBinding(
  def: ActionDefinition,
  mapping: ActionInputMapping,
  context: { readonly routeParamNames: readonly string[] },
): readonly FieldIssue[] {
  const issues: FieldIssue[] = [];
  const inputNames = new Set(def.input.map((spec) => spec.name));
  const allowed = new Set(def.allowedSources);
  const params = new Set(context.routeParamNames);

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
  }

  return issues;
}
