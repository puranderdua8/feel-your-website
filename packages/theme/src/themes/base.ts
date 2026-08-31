import { fontFamily, type ThemeConfig } from "@feel-your-website/tokens";

/**
 * The hard-coded fallback theme. Every Tier 1 token has a real default
 * value — this is the floor every other theme resolves on top of. Tier 2 is
 * intentionally left unset here; `resolveTheme` derives it from whichever
 * Tier 1 values end up active.
 */
export const base: ThemeConfig = {
  tier1: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.15 0.01 260)",
    primary: "oklch(0.55 0.19 258)",
    primaryForeground: "oklch(0.98 0 0)",
    secondary: "oklch(0.96 0.01 260)",
    secondaryForeground: "oklch(0.15 0.01 260)",
    muted: "oklch(0.96 0.01 260)",
    mutedForeground: "oklch(0.48 0.01 260)",
    accent: "oklch(0.94 0.03 258)",
    accentForeground: "oklch(0.15 0.01 260)",
    destructive: "oklch(0.55 0.22 25)",
    destructiveForeground: "oklch(0.98 0 0)",
    border: "oklch(0.9 0.01 260)",
    ring: "oklch(0.55 0.19 258)",
    radius: "0.5rem",
    fontSans: fontFamily.sans,
    fontMono: fontFamily.mono,
  },
};

/** The dark-mode variant of the fallback theme, same completeness guarantee. */
export const baseDark: ThemeConfig = {
  tier1: {
    background: "oklch(0.15 0.01 260)",
    foreground: "oklch(0.96 0.01 260)",
    primary: "oklch(0.65 0.19 258)",
    primaryForeground: "oklch(0.15 0.01 260)",
    secondary: "oklch(0.25 0.01 260)",
    secondaryForeground: "oklch(0.96 0.01 260)",
    muted: "oklch(0.25 0.01 260)",
    mutedForeground: "oklch(0.65 0.01 260)",
    accent: "oklch(0.3 0.03 258)",
    accentForeground: "oklch(0.96 0.01 260)",
    destructive: "oklch(0.6 0.2 25)",
    destructiveForeground: "oklch(0.98 0 0)",
    border: "oklch(0.3 0.01 260)",
    ring: "oklch(0.65 0.19 258)",
    radius: "0.5rem",
    fontSans: fontFamily.sans,
    fontMono: fontFamily.mono,
  },
};
