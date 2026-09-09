import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every state-changing server function must call `assertSameOrigin()` before
 * it does anything. There is no framework hook that enforces this, so a grep
 * over the BFF source stands in for one — the same tactic as `seam.test.ts`.
 *
 * A `createServerFn({ method: "POST" })` that skips the guard is a CSRF hole
 * the moment it touches a cookie, a backend, or an external endpoint.
 */

const bff = readFileSync(join(process.cwd(), "src", "server", "bff.ts"), "utf8");

const POST_FN = /createServerFn\(\{\s*method:\s*["']POST["']\s*\}\)/;

const blocks = bff.split(/^export const /m).filter((block) => POST_FN.test(block));

describe("mutating BFF server functions", () => {
  it("finds POST server functions to check", () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("every POST server function calls assertSameOrigin()", () => {
    const missing = blocks
      .filter((block) => !block.includes("assertSameOrigin("))
      .map((block) => block.slice(0, block.indexOf("=")).trim());

    expect(missing, "these POST server functions are missing assertSameOrigin()").toEqual([]);
  });
});
