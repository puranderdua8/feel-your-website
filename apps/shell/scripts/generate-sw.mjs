import { generateSW } from "workbox-build";
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
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const clientDir = join(root, "dist", "client");

const { count, size, warnings } = await generateSW({
  globDirectory: clientDir,
  // Only fingerprinted client assets are precached. Server-rendered HTML is
  // generated per request and per locale, so it is handled at runtime below.
  globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
  swDest: join(clientDir, "sw.js"),

  // The app prompts before applying an update rather than swapping itself out
  // mid-task, so the new worker must wait to be told to take over.
  skipWaiting: false,
  clientsClaim: false,
  cleanupOutdatedCaches: true,

  runtimeCaching: [
    {
      // Navigations: network first, falling back to the last good response
      // for that URL. Network-first matters because content is CMS-driven and
      // changes without a deploy — cache-first would serve stale copy for as
      // long as the entry lived.
      urlPattern: ({ request }) => request.mode === "navigate",
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
        cacheableResponse: { statuses: [200] },
      },
    },
    {
      // BFF responses. Same reasoning: fresh when possible, last-known when
      // the network is gone.
      urlPattern: ({ url }) => url.pathname.startsWith("/_serverFn/"),
      handler: "NetworkFirst",
      options: {
        cacheName: "bff",
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [200] },
      },
    },
  ],
});

// The registration code posts SKIP_WAITING when the user accepts an update;
// generateSW does not wire that listener when skipWaiting is false, so append
// it. Without this the "Reload" button would do nothing.
const { appendFile } = await import("node:fs/promises");
await appendFile(
  join(clientDir, "sw.js"),
  `\nself.addEventListener('message', (event) => {\n` +
    `  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();\n` +
    `});\n`,
);

for (const warning of warnings) console.warn("[sw]", warning);
console.log(`[sw] precached ${count} files, ${(size / 1024).toFixed(1)} kB → dist/client/sw.js`);
