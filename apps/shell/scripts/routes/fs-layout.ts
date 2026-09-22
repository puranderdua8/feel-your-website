import { fileURLToPath } from "node:url";
import path from "node:path";

/** `apps/shell/`, resolved from this file's location so the CLI works from any cwd. */
export const SHELL_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export const SNAPSHOT_PATH = path.join(SHELL_ROOT, "routes.snapshot.json");
export const CMS_ROUTES_DIR = path.join(SHELL_ROOT, "src/routes/(cms)");
export const MANIFEST_PATH = path.join(SHELL_ROOT, "src/generated/cms-routes.ts");
