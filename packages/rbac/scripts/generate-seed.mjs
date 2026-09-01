#!/usr/bin/env node
// Regenerates the Postgres mirror of the permission catalog.
//
// Run with `pnpm --filter @feel-your-website/rbac generate:seed` after
// changing `PLATFORM_PERMISSIONS`. CI's `seed-drift.test.ts` fails the build
// if this was not run — see that file for what "drift" means here and why
// two separate guards exist.
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { catalogToSeedSql, platformCatalog } from "../dist/index.js";

const outPath = fileURLToPath(new URL("../../../supabase/seed/permissions.sql", import.meta.url));

await mkdir(new URL("../../../supabase/seed/", import.meta.url), { recursive: true });
await writeFile(outPath, catalogToSeedSql(platformCatalog));

console.log(`Wrote ${outPath}`);
