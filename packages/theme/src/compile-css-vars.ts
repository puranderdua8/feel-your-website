import type { Tokens } from "@feel-your-website/tokens";

export type CssVarMap = Record<string, string>;

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function tier1VarName(key: string): string {
  if (key === "fontSans") return "--font-sans";
  if (key === "fontMono") return "--font-mono";
  if (key === "radius") return "--radius";
  // `chart1`..`chart5` need the digit special-cased: kebabCase only inserts
  // a dash at a lower→upper boundary, so it would otherwise leave these as
  // `--chart1` rather than shadcn's `--chart-1`.
  const chart = /^chart([1-5])$/.exec(key);
  if (chart) return `--chart-${chart[1]}`;
  // Every other Tier 1 token is emitted under its own raw shadcn name
  // (`primary` → `--primary`, `cardForeground` → `--card-foreground`), not
  // prefixed with `--color-` — that prefix is the Tailwind namespace the
  // preset's `@theme inline` block maps onto these, not the variable name
  // itself. See tailwind-preset.css.
  return `--${kebabCase(key)}`;
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
