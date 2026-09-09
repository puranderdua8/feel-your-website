import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * This invoker ships in the running shell, so nothing it exports at runtime
 * may drag a test framework in with it. Same guard `content-adapter-supabase`
 * carries.
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
