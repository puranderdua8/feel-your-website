import type { JsonValue } from "@feel-your-website/content-core";
import { createContext, useContext } from "react";

export interface FormContextValue {
  /** Current input values, keyed by each `field` section's `name`. */
  readonly values: Readonly<Record<string, JsonValue>>;
  /** Record a field's value — called by `field` sections on change. */
  readonly setValue: (name: string, value: JsonValue) => void;
}

const FormCtx = createContext<FormContextValue | null>(null);

export const FormProvider = FormCtx.Provider;

/**
 * The enclosing `form` section's state, or `null` when the section is not
 * inside one. A `mode: "action"` button reads it to build `formInput`; a
 * `field` section writes to it.
 */
export function useFormContext(): FormContextValue | null {
  return useContext(FormCtx);
}
