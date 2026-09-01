import { amber, fontFamily, green, red, violet, type ThemeConfig } from "@feel-your-website/tokens";

/**
 * The hard-coded fallback theme. Every Tier 1 token has a real default
 * value — this is the floor every other theme resolves on top of. Tier 2 is
 * intentionally left unset here; `resolveTheme` derives it from whichever
 * Tier 1 values end up active.
 *
 * The shadcn-vocabulary tokens (`card`, `popover`, `input`, `chart1..5`,
 * `sidebar*`) are declared here — and only here — as derivations of the
 * tokens already on this object: `card`/`popover` mirror the page surface,
 * `input` mirrors `border`, `sidebar*` mirrors the equivalent non-sidebar
 * token, and `chart1` is `primary` with `chart2..5` drawn from the other
 * primitive colour ramps in `@feel-your-website/tokens`. `corporate` and
 * `playful` deliberately do not repeat this derivation — they inherit these
 * tokens from this floor and only override the handful of Tier 1 fields
 * that make them look different, same as they already do for the original
 * Tier 1 set.
 */

const background = "oklch(1 0 0)";
const foreground = "oklch(0.15 0.01 260)";
const primary = "oklch(0.55 0.19 258)";
const primaryForeground = "oklch(0.98 0 0)";
const accent = "oklch(0.94 0.03 258)";
const accentForeground = "oklch(0.15 0.01 260)";
const border = "oklch(0.9 0.01 260)";
const ring = "oklch(0.55 0.19 258)";

export const base: ThemeConfig = {
  tier1: {
    background,
    foreground,
    card: background,
    cardForeground: foreground,
    popover: background,
    popoverForeground: foreground,
    primary,
    primaryForeground,
    secondary: "oklch(0.96 0.01 260)",
    secondaryForeground: foreground,
    muted: "oklch(0.96 0.01 260)",
    mutedForeground: "oklch(0.48 0.01 260)",
    accent,
    accentForeground,
    destructive: "oklch(0.55 0.22 25)",
    destructiveForeground: "oklch(0.98 0 0)",
    border,
    input: border,
    ring,
    chart1: primary,
    chart2: green[500],
    chart3: amber[500],
    chart4: violet[500],
    chart5: red[500],
    sidebar: background,
    sidebarForeground: foreground,
    sidebarPrimary: primary,
    sidebarPrimaryForeground: primaryForeground,
    sidebarAccent: accent,
    sidebarAccentForeground: accentForeground,
    sidebarBorder: border,
    sidebarRing: ring,
    radius: "0.5rem",
    fontSans: fontFamily.sans,
    fontMono: fontFamily.mono,
  },
};

const darkBackground = "oklch(0.15 0.01 260)";
const darkForeground = "oklch(0.96 0.01 260)";
const darkPrimary = "oklch(0.65 0.19 258)";
const darkPrimaryForeground = "oklch(0.15 0.01 260)";
const darkAccent = "oklch(0.3 0.03 258)";
const darkAccentForeground = "oklch(0.96 0.01 260)";
const darkBorder = "oklch(0.3 0.01 260)";
const darkRing = "oklch(0.65 0.19 258)";

/** The dark-mode variant of the fallback theme, same completeness guarantee. */
export const baseDark: ThemeConfig = {
  tier1: {
    background: darkBackground,
    foreground: darkForeground,
    card: darkBackground,
    cardForeground: darkForeground,
    popover: darkBackground,
    popoverForeground: darkForeground,
    primary: darkPrimary,
    primaryForeground: darkPrimaryForeground,
    secondary: "oklch(0.25 0.01 260)",
    secondaryForeground: darkForeground,
    muted: "oklch(0.25 0.01 260)",
    mutedForeground: "oklch(0.65 0.01 260)",
    accent: darkAccent,
    accentForeground: darkAccentForeground,
    destructive: "oklch(0.6 0.2 25)",
    destructiveForeground: "oklch(0.98 0 0)",
    border: darkBorder,
    input: darkBorder,
    ring: darkRing,
    chart1: darkPrimary,
    chart2: green[400],
    chart3: amber[400],
    chart4: violet[400],
    chart5: red[400],
    sidebar: darkBackground,
    sidebarForeground: darkForeground,
    sidebarPrimary: darkPrimary,
    sidebarPrimaryForeground: darkPrimaryForeground,
    sidebarAccent: darkAccent,
    sidebarAccentForeground: darkAccentForeground,
    sidebarBorder: darkBorder,
    sidebarRing: darkRing,
    radius: "0.5rem",
    fontSans: fontFamily.sans,
    fontMono: fontFamily.mono,
  },
};
