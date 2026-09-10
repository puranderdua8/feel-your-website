import type {
  ActionInputMapping,
  ActionInputSource,
  MutationActionDefinition,
} from "@feel-your-website/action-core";
import type { JsonValue, SectionFieldSpec } from "@feel-your-website/content-core";

import { sanitizeParam } from "./resolve-route-page.js";

const INPUT_SOURCES = new Set<ActionInputSource>(["static", "routeParam", "formInput"]);

/**
 * Parses the `actionBody` field's stored value — authored in the CMS as a JSON
 * string — into an {@link ActionInputMapping}, or `null` if it is not one. An
 * empty string is an empty mapping; an already-parsed object is accepted too
 * (forward-compatible with a structured control).
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

/** What the builder is allowed to draw a mapped value from. */
export interface BuildActionBodyContext {
  /** The route's resolved params, decoded. The builder re-sanitises each used value. */
  readonly routeParams: Readonly<Record<string, string>>;
  /**
   * Submitted form values, by input name. `formInput` mappings read from here.
   * The form-input primitive is not built yet, so this is normally absent.
   */
  readonly formInput?: Readonly<Record<string, JsonValue>>;
}

/** Coerce a `static` mapping's string literal to the input's declared type. `null` → drop it. */
function coerceStatic(raw: string, type: SectionFieldSpec["type"]): JsonValue | null {
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  }
  return raw;
}

/**
 * Builds the authoritative request body for a mutation invoke — the one the
 * server actually sends upstream.
 *
 * It is driven by `def.input` (the code-defined schema), never by the mapping's
 * own keys: a client that tampered with the published mapping to add inputs the
 * action does not declare, point a `static` value at a secret, or claim a
 * disallowed source gets none of it. `routeParam` values come only from
 * `context.routeParams` and are re-sanitised here; `static` values are the
 * published literal, coerced to the input's type; `formInput` values come only
 * from `context.formInput` and only for declared inputs.
 *
 * An input that is unmapped, maps to a missing route param, fails re-sanitising,
 * or fails coercion is simply absent from the body — `validateActionInput` then
 * reports it as missing/invalid rather than the builder throwing.
 */
export function buildActionBody(
  def: MutationActionDefinition,
  mapping: ActionInputMapping,
  context: BuildActionBodyContext,
): Record<string, JsonValue> {
  const allowed = new Set(def.allowedSources);
  const body: Record<string, JsonValue> = {};

  for (const spec of def.input) {
    const entry = mapping[spec.name];
    if (!entry || !allowed.has(entry.source)) continue;

    if (entry.source === "static") {
      const value = coerceStatic(entry.value, spec.type);
      if (value !== null) body[spec.name] = value;
      continue;
    }

    if (entry.source === "routeParam") {
      const raw = context.routeParams[entry.value];
      const clean = typeof raw === "string" ? sanitizeParam(raw) : null;
      if (clean !== null) body[spec.name] = clean;
      continue;
    }

    // formInput
    const submitted = context.formInput?.[spec.name];
    if (submitted !== undefined) body[spec.name] = submitted;
  }

  return body;
}
