import { Tier1Schema } from "@feel-your-website/tokens";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Resolved from the package root rather than `import.meta.url`: under the
// jsdom environment `import.meta.url` is an http: URL, not a file: one.
const preset = readFileSync(join(process.cwd(), "src", "tailwind-preset.css"), "utf8");

/**
 * Regression cover for a bug where the preset registered only static tokens
 * (font fallbacks, the radius scale) and left every semantic colour out of
 * `@theme`.
 *
 * That looked harmless because `ThemeProvider` injects the colour *values*
 * at runtime. But Tailwind v4 only *generates* a utility like `bg-primary`
 * if `--color-primary` is declared in `@theme` at build time. With them
 * missing, the utilities were never emitted, so every colour class in every
 * component resolved to nothing while the runtime variables sat unread.
 *
 * A browser is the only place to observe the end effect, which is exactly
 * why this test guards the structural cause instead: if a Tier 1 colour
 * token exists in the schema but not in the preset, the utility that
 * consumes it cannot exist either.
 */
describe("tailwind-preset.css", () => {
  const tier1Keys = Object.keys(Tier1Schema.shape);
  const colourKeys = tier1Keys.filter((key) => !["radius", "fontSans", "fontMono"].includes(key));

  const toCssVar = (key: string) =>
    `--color-${key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;

  it.each(colourKeys)("registers %s so its utility is generated", (key) => {
    expect(preset).toContain(`${toCssVar(key)}:`);
  });

  it("registers the font family tokens", () => {
    expect(preset).toContain("--font-sans:");
    expect(preset).toContain("--font-mono:");
  });

  it("registers semantic tokens with `inline` so they resolve per scope", () => {
    // Without `inline`, Tailwind emits its own `:root` declaration and the
    // utility stops tracking whichever [data-theme] scope it lands in.
    const inlineBlock = /@theme\s+inline\s*\{([^}]*)\}/s.exec(preset)?.[1];
    expect(inlineBlock).toBeTruthy();
    expect(inlineBlock).toContain("--color-primary:");
  });
});
