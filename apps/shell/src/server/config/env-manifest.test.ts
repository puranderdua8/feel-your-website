import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SHELL_ENV_MANIFEST } from "./env-manifest.js";

const repoRoot = join(process.cwd(), "..", "..");

/** turbo.json is JSONC — strip whole-line `//` comments before parsing. */
function readJsonc(path: string): Record<string, unknown> {
  const text = readFileSync(join(repoRoot, path), "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(text) as Record<string, unknown>;
}

describe("shell env manifest", () => {
  it("is fully covered by turbo.json globalEnv", () => {
    const globalEnv = (readJsonc("turbo.json").globalEnv as string[] | undefined) ?? [];
    const missing = SHELL_ENV_MANIFEST.filter((name) => !globalEnv.includes(name));
    expect(missing, "add these to turbo.json globalEnv so the build cache keys on them").toEqual(
      [],
    );
  });

  it("documents every variable in .env.example", () => {
    const envExample = readFileSync(join(repoRoot, ".env.example"), "utf8");
    const missing = SHELL_ENV_MANIFEST.filter((name) => !envExample.includes(name));
    expect(missing, "document these in .env.example").toEqual([]);
  });
});
