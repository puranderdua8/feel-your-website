import type { ThemeConfig } from "@feel-your-website/tokens";

/**
 * A simple, conservative theme: only overrides the Tier 1 tokens needed to
 * establish a professional palette. Everything else — including all of
 * Tier 2 — inherits from `base` and the derivation functions.
 */
export const corporate: ThemeConfig = {
  tier1: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.2 0.02 250)",
    primary: "oklch(0.38 0.09 250)",
    primaryForeground: "oklch(0.98 0 0)",
    secondary: "oklch(0.95 0.01 250)",
    muted: "oklch(0.95 0.01 250)",
    accent: "oklch(0.92 0.02 250)",
    destructive: "oklch(0.5 0.18 25)",
    border: "oklch(0.88 0.01 250)",
    ring: "oklch(0.38 0.09 250)",
    radius: "0.25rem",
  },

  /**
   * Dark variant. Hue and chroma carry over from the light palette so the
   * brand still reads as the same theme; only lightness is re-pitched for a
   * dark ground. `radius` is deliberately absent — non-colour tokens are
   * mode-independent and resolved from the light declaration above.
   *
   * Structural default, not a design-reviewed palette.
   */
  dark: {
    tier1: {
      background: "oklch(0.17 0.02 250)",
      foreground: "oklch(0.95 0.01 250)",
      primary: "oklch(0.62 0.11 250)",
      primaryForeground: "oklch(0.15 0.02 250)",
      secondary: "oklch(0.26 0.01 250)",
      secondaryForeground: "oklch(0.95 0.01 250)",
      muted: "oklch(0.26 0.01 250)",
      mutedForeground: "oklch(0.68 0.01 250)",
      accent: "oklch(0.32 0.03 250)",
      accentForeground: "oklch(0.95 0.01 250)",
      destructive: "oklch(0.62 0.2 25)",
      border: "oklch(0.32 0.01 250)",
      ring: "oklch(0.62 0.11 250)",
    },
  },
};
