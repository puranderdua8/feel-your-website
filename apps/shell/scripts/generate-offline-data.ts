import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CMS_ROUTES } from "../src/generated/cms-routes.js";
import { localeConfig } from "../src/i18n/config.js";
import { getContentAdapter } from "../src/server/adapters.js";
import { toOfflineRouteData } from "../src/server/offline-route-data.js";
import { buildPublicBootstrap } from "../src/server/public-bootstrap.js";

/**
 * Writes the build-time offline seed the service worker precaches (plan
 * finding 1/10): one `dist/client/offline-data/<routeKey>.json` per
 * `offline: true` route in the build manifest, and one
 * `dist/client/offline-data/_bootstrap-<locale>.json` per configured locale
 * (messages + nav — the root loader's offline fallback). Both are seeds:
 * a successful `loadRouteContent`/`loadBootstrap` response for the same
 * route/locale refreshes the cached copy while online (stale-while-
 * revalidate) — this is only what a visitor who has never been online for
 * it sees.
 *
 * A no-op, touching no adapter, when nothing is marked offline — most builds
 * don't need a reachable CMS at this step, same as `routes:generate` never
 * does.
 */

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "dist", "client", "offline-data");

async function main(): Promise<void> {
  const offlineRoutes = CMS_ROUTES.filter((route) => route.offline);
  if (offlineRoutes.length === 0) {
    console.log("[offline-data] no offline routes in this build — nothing to generate.");
    return;
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const adapter = getContentAdapter();

  for (const route of offlineRoutes) {
    const bundle = await adapter.getRouteByKey(route.routeKey);
    if (!bundle) {
      throw new Error(
        `offline route "${route.routeKey}" is in the build manifest but not published — rerun routes:sync.`,
      );
    }
    await writeFile(
      join(outDir, `${route.routeKey}.json`),
      JSON.stringify(toOfflineRouteData(bundle)),
    );
  }

  for (const locale of localeConfig.supported) {
    const { messages, nav, degraded } = await buildPublicBootstrap(locale);
    if (degraded) {
      throw new Error(`offline bootstrap seed: the CMS was unreachable for locale "${locale}".`);
    }
    await writeFile(
      join(outDir, `_bootstrap-${locale}.json`),
      JSON.stringify({ locale, messages, nav }),
    );
  }

  console.log(
    `[offline-data] wrote ${offlineRoutes.length} route(s) and ${localeConfig.supported.length} locale bootstrap(s) → dist/client/offline-data/`,
  );
}

await main();
