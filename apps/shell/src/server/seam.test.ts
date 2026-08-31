import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Enforces the rule the whole platform rests on: apps depend on interfaces,
 * never on a concrete backend.
 *
 * `src/server/adapters.ts` is the single dependency-injection point and the
 * only module allowed to name an implementation. Everything else imports
 * `ContentAdapter` / `AuthProvider` and receives one.
 *
 * Without a test this is just a convention, and conventions erode one
 * convenient import at a time — the first `import { createClient } from
 * "@supabase/supabase-js"` in a route is how "the CMS is replaceable" quietly
 * stops being true. A grep is cheap; discovering it during a migration is not.
 */

const srcDir = join(process.cwd(), "src");
const INJECTION_POINT = join("server", "adapters.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/** Packages that name or embed a specific backend. */
const CONCRETE_BACKENDS = [
  "@supabase/supabase-js",
  "@feel-your-website/content-adapter-memory",
  "@feel-your-website/content-adapter-supabase",
];

describe("the adapter seam", () => {
  const files = sourceFiles(srcDir);

  it("finds application sources to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("names a concrete adapter in exactly one module", () => {
    const offenders = files.filter((file) => {
      if (file.endsWith(INJECTION_POINT)) return false;
      const source = readFileSync(file, "utf8");
      return CONCRETE_BACKENDS.some((pkg) => source.includes(pkg));
    });

    expect(
      offenders.map((f) => f.replace(`${process.cwd()}/`, "")),
      "only src/server/adapters.ts may import a concrete adapter",
    ).toEqual([]);
  });

  it("keeps the injection point itself present", () => {
    // Guards against the test passing vacuously because the file was renamed.
    expect(files.some((file) => file.endsWith(INJECTION_POINT))).toBe(true);
  });
});
