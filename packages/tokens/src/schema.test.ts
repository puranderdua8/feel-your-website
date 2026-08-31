import { describe, expect, it } from "vitest";

import { deriveTier2 } from "./derivations.js";
import { fontFamily } from "./primitives/typography.js";
import { TokenSchema, type Tier1Tokens } from "./schema.js";

const minimalTier1: Tier1Tokens = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.2 0 0)",
  primary: "oklch(0.5 0.2 260)",
  primaryForeground: "oklch(1 0 0)",
  secondary: "oklch(0.9 0.02 260)",
  secondaryForeground: "oklch(0.2 0 0)",
  muted: "oklch(0.95 0.01 260)",
  mutedForeground: "oklch(0.45 0.01 260)",
  accent: "oklch(0.9 0.05 260)",
  accentForeground: "oklch(0.2 0 0)",
  destructive: "oklch(0.55 0.22 25)",
  destructiveForeground: "oklch(1 0 0)",
  border: "oklch(0.88 0.01 260)",
  ring: "oklch(0.5 0.2 260)",
  radius: "0.5rem",
  fontSans: fontFamily.sans,
  fontMono: fontFamily.mono,
};

describe("TokenSchema", () => {
  it("parses a minimal fully-resolved object (Tier 2 derived from Tier 1)", () => {
    const result = TokenSchema.safeParse({
      primitives: {
        colors: {},
        spacing: {},
        radius: {},
        typography: { fontFamily: {}, fontSize: {}, fontWeight: {} },
      },
      tier1: minimalTier1,
      tier2: deriveTier2(minimalTier1),
    });

    expect(result.success).toBe(true);
  });

  it("parses a fully-specified object with every field explicitly set", () => {
    const result = TokenSchema.safeParse({
      primitives: {
        colors: { gray: { 50: "oklch(0.98 0.02 260)" } },
        spacing: { 4: "1rem" },
        radius: { md: "0.5rem" },
        typography: {
          fontFamily: { sans: fontFamily.sans, mono: fontFamily.mono },
          fontSize: { base: { size: "1rem", lineHeight: "1.5rem" } },
          fontWeight: { normal: "400" },
        },
      },
      tier1: minimalTier1,
      tier2: {
        buttonHover: "oklch(0.45 0.2 260)",
        buttonActive: "oklch(0.4 0.2 260)",
        cardShadow: "0 1px 2px 0 oklch(0.1 0 0 / 0.08)",
        inputBorder: "oklch(0.85 0.01 260)",
        focusRingWidth: "2px",
        focusRingColor: "oklch(0.5 0.2 260)",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects an object missing required Tier 1 fields", () => {
    const result = TokenSchema.safeParse({
      primitives: {
        colors: {},
        spacing: {},
        radius: {},
        typography: { fontFamily: {}, fontSize: {}, fontWeight: {} },
      },
      tier1: { background: "oklch(1 0 0)" },
      tier2: deriveTier2(minimalTier1),
    });

    expect(result.success).toBe(false);
  });
});
