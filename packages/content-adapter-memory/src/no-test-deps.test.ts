import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * This adapter ships in the running application, so nothing it exports at
 * runtime may drag a test framework in with it.
 *
 * The regression this guards against actually happened: `fixtures.ts` — a
 * runtime module — imported the shared fixture from `content-core/contract-tests`,
 * which imports vitest. The build passed (vitest was marked external) and the
 * dev server then died with "Vitest failed to access its internal state". The
 * fixture data now lives in its own vitest-free module.
 *
 * Type-level checks cannot catch this; only the import graph can.
 */
describe("runtime modules stay free of test dependencies", () => {
  const srcDir = join(process.cwd(), "src");

  const runtimeFiles = readdirSync(srcDir)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));

  it("finds runtime modules to check", () => {
    expect(runtimeFiles.length).toBeGreaterThan(0);
  });

  it.each(runtimeFiles)("%s imports neither vitest nor a contract suite", (file) => {
    const source = readFileSync(join(srcDir, file), "utf8");

    expect(source).not.toMatch(/from\s+["']vitest["']/);
    expect(source).not.toMatch(/contract-tests/);
  });
});
