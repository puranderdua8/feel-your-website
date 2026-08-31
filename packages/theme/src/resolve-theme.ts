import {
  TokenSchema,
  deriveTier2,
  fontFamily,
  fontSize,
  fontWeight,
  radius as radiusPrimitives,
  spacing,
  gray,
  blue,
  red,
  green,
  amber,
  violet,
  type Primitives,
  type Tier1Tokens,
  type Tier2Tokens,
  type ThemeConfig,
  type Tokens,
} from "@feel-your-website/tokens";

import { deepMerge } from "./lib/deep-merge.js";
import { base, baseDark } from "./themes/base.js";
import { themeRegistry } from "./themes/index.js";

export type ThemeMode = "light" | "dark";

/**
 * Tier 1 tokens that describe shape rather than palette. They are identical
 * in light and dark mode, so `resolveTheme` carries them across from the
 * theme's light declaration instead of expecting a `dark` block to repeat
 * them.
 */
const MODE_INDEPENDENT_TIER1 = ["radius", "fontSans", "fontMono"] as const;

/** The Tier 2 equivalent — currently just the focus ring's width. */
const MODE_INDEPENDENT_TIER2 = ["focusRingWidth"] as const;

export interface ResolveThemeOptions {
  mode?: ThemeMode;
  overrides?: ThemeConfig;
}

const staticPrimitives: Primitives = {
  colors: { gray, blue, red, green, amber, violet },
  spacing,
  radius: radiusPrimitives,
  typography: { fontFamily, fontSize, fontWeight },
};

function resolveNamedConfig(themeNameOrConfig: string | ThemeConfig): ThemeConfig {
  if (typeof themeNameOrConfig !== "string") {
    return themeNameOrConfig;
  }

  const found = themeRegistry[themeNameOrConfig];
  if (!found) {
    throw new Error(
      `Unknown theme "${themeNameOrConfig}". Known themes: ${Object.keys(themeRegistry).join(", ")}`,
    );
  }
  return found;
}

/**
 * Resolves a theme name (or inline config) plus optional consumer overrides
 * into a fully-specified, schema-valid token set.
 *
 * Merge order:
 *  1. `base` (or `baseDark` in dark mode) theme defaults — the guaranteed-
 *     complete floor.
 *  2. The theme's overrides for the *active mode* are layered onto that
 *     floor to produce the "active" Tier 1 set. In light mode that is the
 *     theme's top-level `tier1`; in dark mode it is `theme.dark.tier1`.
 *
 *     Layering the light `tier1` onto the dark floor would be wrong, and
 *     used to be the bug here: a theme like `base` specifies every Tier 1
 *     token, so it overwrote the dark floor completely and dark mode
 *     silently rendered the light palette. A theme with no `dark` block now
 *     resolves to the neutral dark floor instead.
 *  3. Tier 2 is derived from that active Tier 1 (so, e.g., changing
 *     `primary` cascades into `buttonHover` automatically).
 *  4. The named theme's explicit Tier 2 overrides are layered on top of the
 *     derived Tier 2 (this is the "reach deeper for more control" path).
 *  5. Optional consumer `overrides` (Tier 1 and/or Tier 2) are layered on
 *     top of everything.
 *  6. The final result is validated against `TokenSchema`.
 */
export function resolveTheme(
  themeNameOrConfig: string | ThemeConfig,
  options: ResolveThemeOptions = {},
): Tokens {
  const { mode = "light", overrides } = options;

  const floor = mode === "dark" ? baseDark : base;
  const named = resolveNamedConfig(themeNameOrConfig);

  // In dark mode the theme contributes only what it explicitly declared for
  // dark. Its light tier1/tier2 must not reach the dark floor.
  const namedLayer = mode === "dark" ? named.dark : named;

  const tier1Active = deepMerge<Tier1Tokens>(
    floor.tier1 as Partial<Tier1Tokens>,
    namedLayer?.tier1 as Partial<Tier1Tokens> | undefined,
  );

  const tier2Derived = deriveTier2(tier1Active);

  const tier2Active = deepMerge<Tier2Tokens>(
    tier2Derived,
    namedLayer?.tier2 as Partial<Tier2Tokens> | undefined,
  );

  // Non-colour tokens describe shape, not palette, so they are the same in
  // both modes. Take them from the theme's own (light) declaration so a
  // `dark` block never has to restate them — otherwise a theme with a
  // custom radius would silently revert to the floor's radius in dark mode.
  for (const key of MODE_INDEPENDENT_TIER1) {
    const value = named.tier1?.[key];
    if (value !== undefined) tier1Active[key] = value;
  }
  for (const key of MODE_INDEPENDENT_TIER2) {
    const value = named.tier2?.[key];
    if (value !== undefined) tier2Active[key] = value;
  }

  const resolved: Tokens = {
    primitives: staticPrimitives,
    tier1: tier1Active,
    tier2: tier2Active,
  };

  const withConsumerOverrides = overrides
    ? deepMerge<Tokens>(resolved, overrides as Partial<Tokens>)
    : resolved;

  return TokenSchema.parse(withConsumerOverrides);
}
