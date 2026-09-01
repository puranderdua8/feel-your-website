import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { platformCatalog } from "./permissions.js";
import { assertSeedMatchesCatalog } from "./seed.js";

/**
 * The first of the two guards the README documents: code ↔ the committed
 * seed file. (The second, seed ↔ the running database, is a startup check in
 * the app — this test cannot see a deploy that skipped migrations.)
 *
 * If this fails, someone changed `PLATFORM_PERMISSIONS` and did not run
 * `pnpm --filter @feel-your-website/rbac generate:seed` — regenerate and
 * commit `supabase/seed/permissions.sql`.
 */
describe("supabase/seed/permissions.sql", () => {
  it("matches platformCatalog", async () => {
    // `import.meta.dirname` rather than `new URL(..., import.meta.url)`:
    // under Vitest's transform, `import.meta.url` is not always a plain
    // `file:` URL, and `fileURLToPath` throws on it ("The URL must be of
    // scheme file"). `dirname` is a plain path string and sidesteps that.
    const seedPath = join(import.meta.dirname, "../../../supabase/seed/permissions.sql");
    const seedSql = await readFile(seedPath, "utf8");

    expect(() => assertSeedMatchesCatalog(platformCatalog, seedSql)).not.toThrow();
  });
});
