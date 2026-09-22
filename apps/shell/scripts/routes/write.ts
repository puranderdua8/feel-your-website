import fs from "node:fs";
import path from "node:path";

import * as prettier from "prettier";

import { renderGeneratedFile, renderManifest } from "./codegen.js";
import { CMS_ROUTES_DIR, MANIFEST_PATH, SNAPSHOT_PATH } from "./fs-layout.js";
import type { GeneratedRouteFile } from "./mapping.js";
import { parseSnapshot, serializeSnapshot, type RoutesSnapshot } from "./snapshot.js";

/**
 * Formats generated source through the repo's own Prettier config before it
 * ever reaches disk, keyed by `filepath` so plugins like
 * `prettier-plugin-tailwindcss` and per-extension rules (JSON vs. TS) apply
 * correctly. This is what keeps `pnpm format:check` — which runs over every
 * committed file, generated or not — from ever drifting against what this
 * generator writes.
 */
async function formatSource(filepath: string, source: string): Promise<string> {
  const config = await prettier.resolveConfig(filepath);
  return prettier.format(source, { ...config, filepath });
}

export function readSnapshotFile(): RoutesSnapshot {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      `${SNAPSHOT_PATH} doesn't exist. Run "routes:sync --from <env>" first to create it.`,
    );
  }
  return parseSnapshot(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
}

export async function writeSnapshotFile(snapshot: RoutesSnapshot): Promise<void> {
  const formatted = await formatSource(SNAPSHOT_PATH, serializeSnapshot(snapshot));
  fs.writeFileSync(SNAPSHOT_PATH, formatted);
}

/** Every `.tsx` file under `CMS_ROUTES_DIR` today, relative to it, POSIX-separated. */
function listExistingGeneratedFiles(): string[] {
  if (!fs.existsSync(CMS_ROUTES_DIR)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".tsx")) {
        out.push(path.relative(CMS_ROUTES_DIR, full).split(path.sep).join("/"));
      }
    }
  };
  walk(CMS_ROUTES_DIR);
  return out;
}

/** Removes now-empty directories under `CMS_ROUTES_DIR`, deepest first. */
function pruneEmptyDirs(dir: string): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) pruneEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== CMS_ROUTES_DIR && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

export interface WriteResult {
  readonly written: readonly string[];
  readonly removed: readonly string[];
}

/**
 * Writes every generated route file and the `cms-routes.ts` manifest,
 * removing any previously generated file that `files` no longer produces
 * (a route renamed or deleted since the last generate).
 */
export async function writeGeneratedFiles(
  files: readonly GeneratedRouteFile[],
  snapshot: RoutesSnapshot,
): Promise<WriteResult> {
  const desired = new Map(files.map((f) => [f.relativePath, f]));
  const existing = new Set(listExistingGeneratedFiles());

  const written: string[] = [];
  for (const file of files) {
    const full = path.join(CMS_ROUTES_DIR, file.relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, await formatSource(full, renderGeneratedFile(file)));
    written.push(file.relativePath);
  }

  const removed: string[] = [];
  for (const relativePath of existing) {
    if (desired.has(relativePath)) continue;
    fs.rmSync(path.join(CMS_ROUTES_DIR, relativePath));
    removed.push(relativePath);
  }
  pruneEmptyDirs(CMS_ROUTES_DIR);

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, await formatSource(MANIFEST_PATH, renderManifest(snapshot)));

  return { written, removed };
}

export interface DriftReport {
  readonly clean: boolean;
  /** Generated files whose on-disk content doesn't match what the snapshot would produce. */
  readonly stale: readonly string[];
  /** Files the snapshot would produce that are missing on disk. */
  readonly missing: readonly string[];
  /** Files on disk under `CMS_ROUTES_DIR` that the snapshot no longer accounts for. */
  readonly extra: readonly string[];
  /** Whether `cms-routes.ts` matches what the snapshot would produce. */
  readonly manifestStale: boolean;
}

/** Read-only counterpart to {@link writeGeneratedFiles}, for `routes:generate --check`. */
export async function checkGeneratedFiles(
  files: readonly GeneratedRouteFile[],
  snapshot: RoutesSnapshot,
): Promise<DriftReport> {
  const stale: string[] = [];
  const missing: string[] = [];
  const desiredPaths = new Set<string>();

  for (const file of files) {
    desiredPaths.add(file.relativePath);
    const full = path.join(CMS_ROUTES_DIR, file.relativePath);
    if (!fs.existsSync(full)) {
      missing.push(file.relativePath);
      continue;
    }
    const expected = await formatSource(full, renderGeneratedFile(file));
    if (fs.readFileSync(full, "utf8") !== expected) stale.push(file.relativePath);
  }

  const existingPaths = listExistingGeneratedFiles();
  const extra = existingPaths.filter((p) => !desiredPaths.has(p));

  const expectedManifest = await formatSource(MANIFEST_PATH, renderManifest(snapshot));
  const manifestStale =
    !fs.existsSync(MANIFEST_PATH) || fs.readFileSync(MANIFEST_PATH, "utf8") !== expectedManifest;

  return {
    clean: stale.length === 0 && missing.length === 0 && extra.length === 0 && !manifestStale,
    stale,
    missing,
    extra,
    manifestStale,
  };
}
