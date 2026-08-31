import { TokenSchema } from "@feel-your-website/tokens";
import { describe, expect, it } from "vitest";

import { resolveTheme } from "./resolve-theme.js";

describe("resolveTheme", () => {
  it("resolves 'corporate' (which only sets ~12 Tier 1 fields) into a fully valid token set", () => {
    const tokens = resolveTheme("corporate");

    const result = TokenSchema.safeParse(tokens);
    expect(result.success).toBe(true);

    // Corporate's own override took effect...
    expect(tokens.tier1.primary).toBe("oklch(0.38 0.09 250)");
    // ...and Tier 2, which corporate never touches, was derived rather than left blank.
    expect(tokens.tier2.buttonHover).toBeTruthy();
    expect(tokens.tier2.buttonHover).not.toBe(tokens.tier1.primary);
  });

  it("layers a one-off consumer override on top of 'playful'", () => {
    const withoutOverride = resolveTheme("playful");
    const withOverride = resolveTheme("playful", {
      overrides: { tier1: { primary: "oklch(0.5 0.3 10)" } },
    });

    expect(TokenSchema.safeParse(withOverride).success).toBe(true);
    expect(withOverride.tier1.primary).toBe("oklch(0.5 0.3 10)");
    expect(withOverride.tier1.primary).not.toBe(withoutOverride.tier1.primary);

    // Everything playful set explicitly and the override didn't touch is untouched.
    expect(withOverride.tier1.radius).toBe(withoutOverride.tier1.radius);
    expect(withOverride.tier2.cardShadow).toBe(withoutOverride.tier2.cardShadow);
  });

  it("throws for an unknown theme name", () => {
    expect(() => resolveTheme("does-not-exist")).toThrow();
  });
});

/**
 * Regression cover for a bug where dark mode silently rendered the light
 * palette. The merge was `deepMerge(darkFloor, theme.tier1)`, and since a
 * theme like `base` specifies every Tier 1 token, it overwrote the dark
 * floor entirely. A theme's light `tier1` must never reach the dark floor.
 */
describe("resolveTheme — dark mode", () => {
  it("does not let a fully-specified theme's light palette overwrite the dark floor", () => {
    const light = resolveTheme("base", { mode: "light" });
    const dark = resolveTheme("base", { mode: "dark" });

    expect(dark.tier1.background).not.toBe(light.tier1.background);
    expect(dark.tier1.foreground).not.toBe(light.tier1.foreground);

    // Sanity: dark really is darker than light, not merely different.
    const lightness = (c: string) => Number(/oklch\(([\d.]+)/.exec(c)?.[1]);
    expect(lightness(dark.tier1.background)).toBeLessThan(lightness(light.tier1.background));
  });

  it("applies a theme's declared dark variant rather than the neutral floor", () => {
    const dark = resolveTheme("corporate", { mode: "dark" });
    const neutralFloor = resolveTheme("base", { mode: "dark" });

    expect(dark.tier1.primary).toBe("oklch(0.62 0.11 250)");
    expect(dark.tier1.primary).not.toBe(neutralFloor.tier1.primary);
  });

  it("carries mode-independent tokens across so a dark block need not repeat them", () => {
    // `corporate` sets radius on its light tier1 only; `playful` likewise
    // sets focusRingWidth on its light tier2 only. Both must survive into
    // dark mode rather than reverting to the floor's defaults.
    expect(resolveTheme("corporate", { mode: "dark" }).tier1.radius).toBe("0.25rem");
    expect(resolveTheme("playful", { mode: "dark" }).tier2.focusRingWidth).toBe("3px");
  });

  it("falls back to the neutral dark floor for a theme with no dark variant", () => {
    const noDarkVariant = { tier1: { primary: "oklch(0.5 0.2 30)" } };

    const dark = resolveTheme(noDarkVariant, { mode: "dark" });
    const floor = resolveTheme({}, { mode: "dark" });

    // The light-only primary must not bleed into dark mode...
    expect(dark.tier1.primary).not.toBe("oklch(0.5 0.2 30)");
    // ...and the result is a coherent dark palette, not a mixed one.
    expect(dark.tier1.background).toBe(floor.tier1.background);
  });

  it("still produces a schema-valid token set in dark mode", () => {
    for (const name of ["base", "corporate", "playful"]) {
      expect(() => TokenSchema.parse(resolveTheme(name, { mode: "dark" }))).not.toThrow();
    }
  });
});
