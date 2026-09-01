import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Same rule, same reasoning as `apps/shell/src/server/seam.test.ts`: exactly
 * one module may name a concrete backend. Kept as its own copy rather than a
 * shared test util because each app's own list of concrete-backend packages
 * differs — this one also depends on `@feel-your-website/config-bundle-supabase`,
 * which `apps/shell` has no reason to.
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
  "@supabase/ssr",
  "@feel-your-website/content-adapter-memory",
  "@feel-your-website/content-adapter-supabase",
  "@feel-your-website/auth-supabase",
  "@feel-your-website/config-bundle-supabase",
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
    expect(files.some((file) => file.endsWith(INJECTION_POINT))).toBe(true);
  });
});
