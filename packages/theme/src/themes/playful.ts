import type { ThemeConfig } from "@feel-your-website/tokens";

/**
 * A complex theme: overrides Tier 1 tokens AND reaches into Tier 2 to
 * explicitly set several extended tokens, proving the "reach deeper for
 * more control" path (rather than relying only on derivation defaults).
 */
export const playful: ThemeConfig = {
  tier1: {
    background: "oklch(0.99 0.01 95)",
    foreground: "oklch(0.2 0.04 320)",
    primary: "oklch(0.68 0.24 340)",
    primaryForeground: "oklch(0.99 0 0)",
    secondary: "oklch(0.93 0.06 200)",
    secondaryForeground: "oklch(0.2 0.04 320)",
    muted: "oklch(0.94 0.03 95)",
    mutedForeground: "oklch(0.45 0.03 320)",
    accent: "oklch(0.85 0.15 95)",
    accentForeground: "oklch(0.2 0.04 320)",
    destructive: "oklch(0.62 0.25 25)",
    destructiveForeground: "oklch(0.99 0 0)",
    border: "oklch(0.88 0.05 340)",
    ring: "oklch(0.68 0.24 340)",
    radius: "1.25rem",
  },
  tier2: {
    buttonHover: "oklch(0.6 0.26 340)",
    buttonActive: "oklch(0.52 0.27 340)",
    cardShadow: "0 8px 24px 0 oklch(0.68 0.24 340 / 0.18), 0 2px 6px 0 oklch(0.68 0.24 340 / 0.12)",
    focusRingWidth: "3px",
  },

  /**
   * Dark variant, exercising the same "reach into Tier 2" path as the light
   * theme above. `radius` and `focusRingWidth` are deliberately absent —
   * both are mode-independent and carried over from the light declaration.
   *
   * Structural default, not a design-reviewed palette.
   */
  dark: {
    tier1: {
      background: "oklch(0.18 0.02 320)",
      foreground: "oklch(0.96 0.02 95)",
      primary: "oklch(0.72 0.22 340)",
      primaryForeground: "oklch(0.16 0.04 340)",
      secondary: "oklch(0.3 0.06 200)",
      secondaryForeground: "oklch(0.96 0.02 200)",
      muted: "oklch(0.28 0.02 320)",
      mutedForeground: "oklch(0.7 0.03 320)",
      accent: "oklch(0.45 0.12 95)",
      accentForeground: "oklch(0.97 0.02 95)",
      destructive: "oklch(0.68 0.22 25)",
      destructiveForeground: "oklch(0.16 0.04 25)",
      border: "oklch(0.34 0.06 340)",
      ring: "oklch(0.72 0.22 340)",
    },
    tier2: {
      buttonHover: "oklch(0.66 0.24 340)",
      buttonActive: "oklch(0.6 0.25 340)",
      cardShadow:
        "0 8px 24px 0 oklch(0.05 0.02 320 / 0.5), 0 2px 6px 0 oklch(0.05 0.02 320 / 0.35)",
    },
  },
};
