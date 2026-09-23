import { copyWorkboxLibraries, injectManifest } from "workbox-build";
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Generates the service worker after the Vite build.
 *
 * A post-build step rather than a Vite plugin because TanStack Start runs two
 * build environments, and vite-plugin-pwa produced a manifest in both while
 * generating no worker at all. Running Workbox directly sidesteps the
 * orchestration entirely: it reads the finished client output and writes one
 * file, with no opinion about how that output was produced.
 *
 * `injectManifest`, not `generateSW`: the runtime-caching logic lives in
 * `sw-src.js` (see that file's doc comment for why it needs to be
 * hand-written), and this step only substitutes the real precache manifest
 * and the local Workbox runtime's path in for `sw-src.js`'s placeholders.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(root, "dist", "client");

// `copyWorkboxLibraries` — self-hosted, as every other asset this app serves
// is, rather than `sw-src.js`'s alternative of `importScripts`-ing the
// official CDN. Returns the (version-hashed) directory name it created.
const workboxLibsDir = await copyWorkboxLibraries(clientDir);

// `injectManifest` only substitutes `self.__WB_MANIFEST`; `sw-src.js`'s own
// `__WORKBOX_LIBS_IMPORT__` placeholder is ours to fill in first, into a
// scratch file `injectManifest` reads as `swSrc` and this script deletes
// once done.
const swSrcTemplate = join(root, "scripts", "sw-src.js");
const swSrcResolved = join(root, "scripts", ".sw-src.generated.js");
const template = await readFile(swSrcTemplate, "utf8");
await writeFile(
  swSrcResolved,
  template.replace("__WORKBOX_LIBS_IMPORT__", `./${workboxLibsDir}/workbox-sw.js`),
);

const { count, size, warnings } = await injectManifest({
  swSrc: swSrcResolved,
  swDest: join(clientDir, "sw.js"),
  globDirectory: clientDir,
  // Fingerprinted client assets, plus `_shell.html` — the SPA-shell TanStack
  // Start's `spa` build option prerenders (`vite.config.ts`), precached as
  // the offline navigation fallback `sw-src.js`'s `setCatchHandler` serves.
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  // The just-copied Workbox runtime is itself served from `dist/client/` —
  // `importScripts` fetches it at install time, so it needs no cache-busting
  // precache entry of its own (unlike the fingerprinted build assets above).
  globIgnores: [`${workboxLibsDir}/**/*`],
});

await rm(swSrcResolved);

for (const warning of warnings) console.warn("[sw]", warning);
console.log(`[sw] precached ${count} files, ${(size / 1024).toFixed(1)} kB → dist/client/sw.js`);
