import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The section registry is imported by both apps and runs during SSR and in
 * the CMS preview. It must stay a pure, framework-neutral rendering layer:
 *
 * - no "use client" — nothing here is a client-only module
 * - no data fetching — sections render from the data they are handed
 * - no runtime import of the router or a capability package (analytics /
 *   actions / data). A type-only "import type" is fine; tsup strips it.
 *
 * Same tactic as apps/-star-/src/server/seam.test.ts.
 */
const srcDir = join(process.cwd(), "src");

const runtimeFiles = readdirSync(srcDir)
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => join(srcDir, file));

const FORBIDDEN_RUNTIME_IMPORTS = ["@tanstack/react-router", "@feel-your-website/analytics"];
const FORBIDDEN_PREFIXES = ["@feel-your-website/action", "@feel-your-website/data-source"];

function runtimeImportLines(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => /^\s*import\s+(?!type\b)/.test(line) && /\bfrom\s+["']/.test(line));
}

describe("section-registry stays pure", () => {
  it("finds runtime modules to check", () => {
    expect(runtimeFiles.length).toBeGreaterThan(0);
  });

  it.each(runtimeFiles)("%s has no client, fetch or router/capability coupling", (file) => {
    const source = readFileSync(file, "utf8");

    expect(/["']use client["']/.test(source)).toBe(false);
    expect(/\bfetch\s*\(/.test(source)).toBe(false);

    for (const line of runtimeImportLines(source)) {
      for (const name of FORBIDDEN_RUNTIME_IMPORTS) {
        expect(line.includes(name), `runtime import of ${name} in ${file}`).toBe(false);
      }
      for (const prefix of FORBIDDEN_PREFIXES) {
        expect(line.includes(prefix), `runtime import from ${prefix}* in ${file}`).toBe(false);
      }
    }
  });
});
