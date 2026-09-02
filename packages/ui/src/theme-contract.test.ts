import { compileCssVars, resolveTheme } from "@feel-your-website/theme";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression cover for a silent-failure class: a component referencing a CSS
 * custom property that the theme never emits.
 *
 * Eleven such references existed across six components — `--color-focus-ring`
 * (the theme emits `--focus-ring-color`), `--color-button-hover`
 * (`--button-hover`) and `--color-input-border` (`--input-border`). Each one
 * resolved to nothing, so focus rings, hover states and input borders simply
 * did not render. Nothing failed loudly; the styles were just absent.
 *
 * This asserts the contract directly: the set of variables the components
 * read must be a subset of the set the theme writes.
 */

// Resolved from the package root rather than `import.meta.url`: under the
// jsdom environment `import.meta.url` is an http: URL, not a file: one.
const componentsDir = join(process.cwd(), "src", "components");

function componentSources(): { name: string; source: string }[] {
  return readdirSync(componentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) =>
      readdirSync(join(componentsDir, dir.name))
        .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"))
        .map((file) => ({
          name: `${dir.name}/${file}`,
          source: readFileSync(join(componentsDir, dir.name, file), "utf8"),
        })),
    );
}

/**
 * Variables supplied by something other than the theme package — Radix
 * primitives that publish measured values as CSS custom properties, and
 * vars a component sets on itself via inline `style`. These are not theme
 * tokens and are never expected to come from `compileCssVars`.
 */
const EXTERNALLY_PROVIDED = new Set<string>([
  // Published by @radix-ui primitives as measured values on their own nodes.
  "--radix-select-trigger-height",
  "--radix-select-trigger-width",
  "--radix-navigation-menu-viewport-height",
  "--radix-navigation-menu-viewport-width",
  // Set by `<ToggleGroup>` itself: `style={{ "--gap": spacing }}`.
  "--gap",
]);

describe("components ↔ theme variable contract", () => {
  const emitted = new Set(Object.keys(compileCssVars(resolveTheme("base"))));
  const sources = componentSources();

  it("finds component sources to check", () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it.each(sources)("$name references only variables the theme emits", ({ source }) => {
    const referenced = [...source.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(
      (match) => match[1] as string,
    );

    const unknown = referenced.filter(
      (name) => !emitted.has(name) && !EXTERNALLY_PROVIDED.has(name),
    );

    expect(unknown).toEqual([]);
  });
});
