import { ThemeProvider } from "@puranderdua8/theme/client";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeShowcase } from "./theme-showcase";

/**
 * `@puranderdua8/theme` already unit-tests that ThemeProvider resolves
 * different tokens per theme. These tests assert the level above that: the
 * consuming app's real UI components, wired through the Tailwind preset,
 * actually pick those tokens up — and that one component definition serves
 * every theme.
 *
 * Phase 1's stated exit criterion is "a second ThemeConfig visibly changes
 * the components with no code edit". This is that criterion, executable.
 */
describe("theming contract", () => {
  it("renders one component definition under three themes with distinct tokens", () => {
    const { container } = render(
      <>
        <ThemeProvider theme="base">
          <ThemeShowcase />
        </ThemeProvider>
        <ThemeProvider theme="corporate">
          <ThemeShowcase />
        </ThemeProvider>
        <ThemeProvider theme="playful">
          <ThemeShowcase />
        </ThemeProvider>
      </>,
    );

    const scopes = ["base", "corporate", "playful"].map((name) => {
      const el = container.querySelector<HTMLElement>(`[data-theme="${name}"]`);
      expect(el, `missing themed scope for "${name}"`).toBeTruthy();
      return el as HTMLElement;
    });

    // Each themed scope must carry its own compiled custom properties.
    const primaries = scopes.map((el) => el.style.getPropertyValue("--color-primary"));
    expect(primaries.every(Boolean)).toBe(true);
    expect(new Set(primaries).size).toBe(primaries.length);

    // And each must actually contain the rendered component, so we know the
    // tokens above belong to a real tree rather than an empty wrapper.
    for (const scope of scopes) {
      expect(within(scope).getByText("Session capture")).toBeTruthy();
      expect(within(scope).getByLabelText("Customer name")).toBeTruthy();
    }
  });

  it("gives each instance its own label association", () => {
    // Rendering the showcase more than once on a page must not produce
    // duplicate DOM ids — otherwise every label points at the first input.
    const { container } = render(
      <>
        <ThemeProvider theme="base">
          <ThemeShowcase />
        </ThemeProvider>
        <ThemeProvider theme="corporate">
          <ThemeShowcase />
        </ThemeProvider>
      </>,
    );

    const ids = [...container.querySelectorAll("input")].map((el) => el.id);
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it("renders light and dark mode with genuinely different tokens", () => {
    // Requires @puranderdua8/theme >= 0.3.0. Before that, resolveTheme
    // layered a theme's light tier1 onto the dark floor, so a fully
    // specified theme like `base` rendered identically in both modes.
    const { container } = render(
      <>
        <div data-mode="light">
          <ThemeProvider theme="base" mode="light">
            <ThemeShowcase />
          </ThemeProvider>
        </div>
        <div data-mode="dark">
          <ThemeProvider theme="base" mode="dark">
            <ThemeShowcase />
          </ThemeProvider>
        </div>
      </>,
    );

    const scopeFor = (mode: string) =>
      container.querySelector<HTMLElement>(`[data-mode="${mode}"] [data-theme="base"]`);

    const light = scopeFor("light");
    const dark = scopeFor("dark");

    expect(dark?.className).toContain("dark");

    const lightness = (el: HTMLElement | null) =>
      Number(/oklch\(([\d.]+)/.exec(el?.style.getPropertyValue("--color-background") ?? "")?.[1]);

    expect(lightness(dark)).toBeLessThan(lightness(light));
  });

  it("keeps a branded theme's identity in dark mode", () => {
    // `corporate` declares its own dark variant, so it must not collapse to
    // the neutral dark floor.
    const { container } = render(
      <>
        <div data-name="corporate">
          <ThemeProvider theme="corporate" mode="dark">
            <ThemeShowcase />
          </ThemeProvider>
        </div>
        <div data-name="base">
          <ThemeProvider theme="base" mode="dark">
            <ThemeShowcase />
          </ThemeProvider>
        </div>
      </>,
    );

    const primaryOf = (name: string) =>
      container
        .querySelector<HTMLElement>(`[data-name="${name}"] [data-theme]`)
        ?.style.getPropertyValue("--color-primary");

    expect(primaryOf("corporate")).toBeTruthy();
    expect(primaryOf("corporate")).not.toBe(primaryOf("base"));

    // Non-colour tokens are mode-independent: corporate's 0.25rem radius
    // must survive into dark mode rather than reverting to the floor's.
    const radius = container
      .querySelector<HTMLElement>('[data-name="corporate"] [data-theme]')
      ?.style.getPropertyValue("--radius");
    expect(radius).toBe("0.25rem");
  });

  it("exposes every button variant from a single definition", () => {
    render(
      <ThemeProvider theme="base">
        <ThemeShowcase />
      </ThemeProvider>,
    );

    for (const label of ["Primary", "Secondary", "Outline", "Ghost"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });
});
