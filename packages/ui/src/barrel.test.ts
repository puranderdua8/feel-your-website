import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The barrel (`src/index.ts`) is hand-maintained, not glob-generated — a
 * deliberate choice so the package's public surface is one readable file
 * rather than a build artifact. The cost is that `shadcn add` writes a new
 * component into `src/components/ui/` without touching the barrel, and the
 * new component is then silently unexported.
 *
 * This test closes that gap: every non-story `.tsx` under `components/ui/`
 * must have a matching `export * from "./components/ui/<name>.js"` line in
 * `src/index.ts`.
 */

// process.cwd() is the package root under Vitest — `import.meta.url` is an
// http: URL in the jsdom environment, same caveat as theme-contract.test.ts.
const uiDir = join(process.cwd(), "src", "components", "ui");
const barrel = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");

const componentFiles = readdirSync(uiDir)
  .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"))
  .map((file) => file.replace(/\.tsx$/, ""));

describe("component barrel", () => {
  it("finds component files to check", () => {
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it.each(componentFiles)("src/index.ts re-exports components/ui/%s", (name) => {
    expect(barrel).toContain(`export * from "./components/ui/${name}.js";`);
  });
});
