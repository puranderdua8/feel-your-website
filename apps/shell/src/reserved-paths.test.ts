import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isReservedRoutePath } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

/**
 * `content-core`'s `RESERVED_ROUTE_PREFIXES` is hand-maintained, shared by the
 * CMS (blocks authoring one) and `routes:generate` (refuses to write one). This
 * is the guard: it derives every **hand-written** static file route from the
 * committed `routeTree.gen.ts` — everything except `/`, the `/$` splat, params,
 * and anything under the `(cms)` group, which is CMS-authored content, not a
 * reserved path — and asserts each one is covered. A new hand-written route
 * fails here until it's added to `RESERVED_ROUTE_PREFIXES` (or deliberately
 * left out, like `/`).
 */
describe("RESERVED_ROUTE_PREFIXES", () => {
  it("covers every hand-written static file route", () => {
    // vitest runs from the package root (`apps/shell`).
    const gen = readFileSync(resolve(process.cwd(), "src/routeTree.gen.ts"), "utf8");

    const handWrittenPaths = [
      ...gen.matchAll(/^import \{ Route as \w+ \} from '\.\/routes\/([^']+)'/gm),
    ]
      .map((m) => m[1]!)
      .filter(
        (p) =>
          p !== "__root" &&
          p !== "index" &&
          p !== "$" &&
          !p.startsWith("(cms)/") &&
          !p.includes("$"),
      )
      .map((p) => `/${p}`);

    for (const path of handWrittenPaths) {
      expect(isReservedRoutePath(path)).toBe(true);
    }
  });

  it("does not reserve any CMS route in the committed snapshot", () => {
    const snapshot = JSON.parse(
      readFileSync(resolve(process.cwd(), "routes.snapshot.json"), "utf8"),
    ) as { routes: readonly { path: string }[] };

    for (const route of snapshot.routes) {
      expect(isReservedRoutePath(route.path)).toBe(false);
    }
  });
});
