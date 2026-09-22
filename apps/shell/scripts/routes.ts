/**
 * CLI entry for the CMS route generator (plan Phase 2). Thin on purpose — all
 * the logic it calls into (`scripts/routes/*.ts`) is pure or file-scoped and
 * independently unit-tested; this file only parses argv, wires env, and
 * prints. Run via `tsx` (this repo's TS runner for standalone scripts — see
 * `package.json`'s `routes:*` scripts), never imported by the app itself.
 *
 * Commands:
 *   routes:sync --from <memory|supabase>   Refresh routes.snapshot.json from a CMS.
 *   routes:generate [--check]              Write (cms)/** and cms-routes.ts from the snapshot.
 *   routes:check --against <memory|supabase>  Report drift, no writes.
 */
import { getContentAdapter, resetAdapters } from "../src/server/adapters.js";
import { diffAgainstSnapshot } from "./routes/check.js";
import { planGeneratedFiles } from "./routes/mapping.js";
import {
  readSnapshotFile,
  writeSnapshotFile,
  writeGeneratedFiles,
  checkGeneratedFiles,
} from "./routes/write.js";
import { buildSnapshotFromAdapter, fetchSnapshotSourceBundles } from "./routes/sync.js";

const DEFAULT_LOCALE = "en";
type AdapterEnv = "memory" | "supabase";

function parseEnvFlag(argv: readonly string[], flag: string): AdapterEnv {
  const i = argv.indexOf(flag);
  const value = i >= 0 ? argv[i + 1] : undefined;
  if (value !== "memory" && value !== "supabase") {
    throw new Error(`${flag} requires "memory" or "supabase" (got ${JSON.stringify(value)}).`);
  }
  return value;
}

function withAdapterEnv<T>(env: AdapterEnv, fn: () => Promise<T>): Promise<T> {
  const previous = process.env.CONTENT_ADAPTER;
  process.env.CONTENT_ADAPTER = env;
  resetAdapters();
  return fn().finally(() => {
    process.env.CONTENT_ADAPTER = previous;
    resetAdapters();
  });
}

async function cmdSync(argv: readonly string[]): Promise<void> {
  const env = parseEnvFlag(argv, "--from");
  const snapshot = await withAdapterEnv(env, () =>
    buildSnapshotFromAdapter(getContentAdapter(), DEFAULT_LOCALE),
  );
  await writeSnapshotFile(snapshot);
  console.log(`routes.snapshot.json refreshed from "${env}": ${snapshot.routes.length} route(s).`);
}

async function cmdGenerate(argv: readonly string[]): Promise<void> {
  const check = argv.includes("--check");
  const snapshot = readSnapshotFile();
  const { files, errors } = planGeneratedFiles(snapshot);

  if (errors.length > 0) {
    console.error("routes:generate found problems in routes.snapshot.json:");
    for (const e of errors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  if (check) {
    const report = await checkGeneratedFiles(files, snapshot);
    if (report.clean) {
      console.log(`routes:generate --check: clean (${files.length} file(s), no drift).`);
      return;
    }
    console.error("routes:generate --check found drift:");
    for (const p of report.missing) console.error(`  missing:  ${p}`);
    for (const p of report.stale) console.error(`  stale:    ${p}`);
    for (const p of report.extra) console.error(`  extra:    ${p}`);
    if (report.manifestStale) console.error("  stale:    src/generated/cms-routes.ts");
    process.exitCode = 1;
    return;
  }

  const result = await writeGeneratedFiles(files, snapshot);
  console.log(
    `routes:generate: wrote ${result.written.length} file(s)${result.removed.length ? `, removed ${result.removed.length} stale file(s)` : ""}.`,
  );
}

async function cmdCheckAgainst(argv: readonly string[]): Promise<void> {
  const env = parseEnvFlag(argv, "--against");
  const published = await withAdapterEnv(env, () =>
    fetchSnapshotSourceBundles(getContentAdapter(), DEFAULT_LOCALE),
  );
  const snapshot = readSnapshotFile();
  const drift = diffAgainstSnapshot(published, snapshot);

  if (drift.missingFromSnapshot.length === 0 && drift.removedFromCms.length === 0) {
    console.log(`routes:check --against ${env}: in sync.`);
    return;
  }
  if (drift.missingFromSnapshot.length > 0) {
    console.log(
      `Published in "${env}" but not yet in routes.snapshot.json (pending — not in code yet):`,
    );
    for (const k of drift.missingFromSnapshot) console.log(`  - ${k}`);
  }
  if (drift.removedFromCms.length > 0) {
    console.log(`In routes.snapshot.json but no longer published in "${env}":`);
    for (const k of drift.removedFromCms) console.log(`  - ${k}`);
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === "sync") return cmdSync(rest);
  if (command === "generate") return cmdGenerate(rest);
  if (command === "check") return cmdCheckAgainst(rest);

  console.error(
    "Usage: routes.ts <sync --from <env> | generate [--check] | check --against <env>>",
  );
  process.exitCode = 1;
}

void main();
