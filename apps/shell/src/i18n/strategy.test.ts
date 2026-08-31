import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The locale *strategy* — whether the language lives in a cookie or in the
 * URL — must be swappable by editing `src/i18n/` alone.
 *
 * This started out untrue. The policy was spread across the BFF (which read
 * the cookie), the router (which rewrote URLs), the switcher (which knew it
 * needed a server round-trip) and the root route (which threaded a locale
 * through the loader). Changing strategy meant four files in three layers,
 * and nothing would have told you if a fifth crept in.
 *
 * These tests pin the seam: mechanism words appear only inside `src/i18n/`.
 */

const srcDir = join(process.cwd(), "src");
const STRATEGY_DIR = join(srcDir, "i18n");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * Tokens that name *how* a locale is carried or stored. Any of these outside
 * the strategy directory means the mechanism has leaked.
 */
const MECHANISM = [
  "LOCALE_COOKIE",
  "setCookie",
  "getCookie",
  "document.cookie",
  "localStorage",
  "localizePath",
  "deLocalizePath",
  "extractLocaleFromPath",
  "negotiateLocale",
];

describe("locale strategy is isolated", () => {
  const outside = sourceFiles(srcDir).filter((file) => !file.startsWith(STRATEGY_DIR));

  it("finds application sources outside the strategy directory", () => {
    expect(outside.length).toBeGreaterThan(0);
  });

  it.each(MECHANISM)("no file outside src/i18n references %s", (token) => {
    const offenders = outside
      .filter((file) => readFileSync(file, "utf8").includes(token))
      .map((file) => relative(process.cwd(), file));

    expect(offenders, `"${token}" is a locale mechanism and belongs in src/i18n/`).toEqual([]);
  });

  it("keeps both halves of the strategy present", () => {
    // Guards against the tests passing because the files were renamed away.
    const strategyFiles = sourceFiles(STRATEGY_DIR).map((f) => relative(STRATEGY_DIR, f));

    expect(strategyFiles).toContain("strategy.server.ts");
    expect(strategyFiles).toContain("strategy.ui.ts");
    expect(strategyFiles).toContain("config.ts");
  });

  it("does not name a browser-only file `.client.`", () => {
    // `*.client.*` is reserved by TanStack Start and denied in the server
    // bundle; router.tsx imports the UI half and runs on both sides.
    const strategyFiles = sourceFiles(STRATEGY_DIR);
    expect(strategyFiles.filter((f) => f.includes(".client."))).toEqual([]);
  });
});
