import { render } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeProvider.js";

/**
 * These tests exist specifically to confirm the package's central claim: the
 * same @feel-your-website/theme package can drive multiple, independently
 * themed apps — or multiple themed regions within one app — purely by
 * passing a different `theme` prop, with no code changes and no per-theme
 * builds. `resolve-theme.test.ts` already proves the pure resolver function
 * behaves correctly in isolation; these prove the same thing through the
 * actual React component consumers use.
 */
describe("ThemeProvider — multi-theme reuse", () => {
  it("two independent instances (e.g. two separate apps) render different resolved tokens from the same package, by prop alone", () => {
    const { container } = render(
      <div>
        <ThemeProvider theme="corporate">
          <span data-testid="a">A</span>
        </ThemeProvider>
        <ThemeProvider theme="playful">
          <span data-testid="b">B</span>
        </ThemeProvider>
      </div>,
    );

    const corporateScope = container.querySelector('[data-theme="corporate"]') as HTMLElement;
    const playfulScope = container.querySelector('[data-theme="playful"]') as HTMLElement;

    expect(corporateScope).toBeTruthy();
    expect(playfulScope).toBeTruthy();
    expect(corporateScope.style.getPropertyValue("--color-primary")).not.toBe(
      playfulScope.style.getPropertyValue("--color-primary"),
    );
    // corporate is a "simple" theme (Tier 1 only) — its radius still resolves
    // to a real value even though it never sets Tier 2 itself.
    expect(corporateScope.style.getPropertyValue("--radius")).toBeTruthy();
  });

  it("nests correctly: an inner ThemeProvider re-themes only its own subtree, without mutating the outer scope", () => {
    const { container } = render(
      <ThemeProvider theme="corporate">
        <span data-testid="outer">outer</span>
        <ThemeProvider theme="playful">
          <span data-testid="inner">inner</span>
        </ThemeProvider>
      </ThemeProvider>,
    );

    const outerScope = container.querySelector('[data-theme="corporate"]') as HTMLElement;
    const innerScope = container.querySelector('[data-theme="playful"]') as HTMLElement;

    expect(outerScope.style.getPropertyValue("--color-primary")).not.toBe(
      innerScope.style.getPropertyValue("--color-primary"),
    );
    // The outer scope's own explicit value is untouched by the nested override.
    expect(outerScope.style.getPropertyValue("--color-primary")).toBe("oklch(0.38 0.09 250)");
  });

  it("accepts an inline ThemeConfig object instead of a registered theme name — for one-off, per-app-only themes never added to the shared registry", () => {
    const { container } = render(
      <ThemeProvider theme={{ tier1: { primary: "oklch(0.4 0.2 10)" } }}>
        <span>content</span>
      </ThemeProvider>,
    );

    const scope = container.querySelector('[data-theme="custom"]') as HTMLElement;
    expect(scope.style.getPropertyValue("--color-primary")).toBe("oklch(0.4 0.2 10)");
  });

  it("layers a one-off `overrides` prop on top of a named theme without registering a new theme", () => {
    const { container } = render(
      <ThemeProvider theme="corporate" overrides={{ tier1: { radius: "0rem" } }}>
        <span>content</span>
      </ThemeProvider>,
    );

    const scope = container.querySelector('[data-theme="corporate"]') as HTMLElement;
    expect(scope.style.getPropertyValue("--radius")).toBe("0rem");
    // Everything corporate set that the override didn't touch is untouched.
    expect(scope.style.getPropertyValue("--color-primary")).toBe("oklch(0.38 0.09 250)");
  });

  it("useTheme() resolves to the nearest ThemeProvider, not an outer one", () => {
    const seen: string[] = [];
    function Reporter() {
      seen.push(useTheme().themeName);
      return null;
    }

    render(
      <ThemeProvider theme="corporate">
        <Reporter />
        <ThemeProvider theme="playful">
          <Reporter />
        </ThemeProvider>
      </ThemeProvider>,
    );

    expect(seen).toEqual(["corporate", "playful"]);
  });

  it("throws a clear error when useTheme() is called outside any ThemeProvider", () => {
    function Orphan() {
      useTheme();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/must be used within a <ThemeProvider>/);
  });
});
