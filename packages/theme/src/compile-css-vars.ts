import type { Tokens } from "@feel-your-website/tokens";

export type CssVarMap = Record<string, string>;

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function tier1VarName(key: string): string {
  if (key === "fontSans") return "--font-sans";
  if (key === "fontMono") return "--font-mono";
  if (key === "radius") return "--radius";
  return `--color-${kebabCase(key)}`;
}

function tier2VarName(key: string): string {
  return `--${kebabCase(key)}`;
}

/**
 * Compiles a fully-resolved token object into a flat map of CSS custom
 * property names to values, e.g. `{ "--color-primary": "oklch(...)" }`.
 */
export function compileCssVars(tokens: Tokens): CssVarMap {
  const vars: CssVarMap = {};

  for (const [key, value] of Object.entries(tokens.tier1)) {
    vars[tier1VarName(key)] = value;
  }

  for (const [key, value] of Object.entries(tokens.tier2)) {
    vars[tier2VarName(key)] = value;
  }

  return vars;
}

/** Serializes a CSS var map into a `--key: value;` string body. */
export function cssVarsToString(vars: CssVarMap): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join("\n");
}
