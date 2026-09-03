import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { RESERVED_PATHS } from "./reserved-paths.js";

/**
 * `RESERVED_PATHS` is hand-maintained rather than generated, so this test is the
 * guard: it derives the static file-route paths from the committed
 * `routeTree.gen.ts` and asserts the list is in sync. A new static file route
 * fails here until it is either reserved or deliberately excluded (like `/`,
 * which `index.tsx` hands to the matcher).
 */
describe("RESERVED_PATHS", () => {
  it("covers every static file route except `/` and the `/$` splat", () => {
    // vitest runs from the package root (`apps/shell`).
    const gen = readFileSync(resolve(process.cwd(), "src/routeTree.gen.ts"), "utf8");

    const staticPaths = [...gen.matchAll(/path:\s*'([^']+)'/g)]
      .map((m) => m[1]!)
      .filter((p) => p !== "/" && p !== "/$" && !p.includes("$"));

    expect([...RESERVED_PATHS].sort()).toEqual([...new Set(staticPaths)].sort());
  });
});
