/**
 * Compares the CMS's live published routes against a deployed shell build's
 * own `/build-info.json` (plan Phase 5) — `apps/shell/scripts/generate-build-info.ts`
 * writes that file at build time from the exact same `routes.snapshot.json`
 * lineage `routes:sync`/`routes:generate` do, so a route key missing from it
 * is a route that's published here but hasn't reached a deployed build yet:
 * "pending — not in code yet".
 *
 * `fetchDeployStatus` is the one impure edge (an HTTP call to another app's
 * public endpoint) and fails soft to `null` — a missing `SHELL_BASE_URL`, an
 * unreachable deploy, or a response that doesn't parse all mean the same
 * thing to the editor: this one status can't be shown right now, same as a
 * route with no CMS reachable falls back to its bootstrap set rather than
 * failing the page.
 */

export interface DeployStatus {
  readonly snapshotHash: string;
  readonly builtAt: string;
  readonly routeKeys: readonly string[];
  /**
   * The deployed build's route path patterns (`/blog/:slug`) — what a CTA's
   * internal link is checked against, since a link to a route not in the
   * build lands on the 404 page until the next deploy.
   */
  readonly routePaths: readonly string[];
}

const FETCH_TIMEOUT_MS = 3_000;

export async function fetchDeployStatus(baseUrl: string | undefined): Promise<DeployStatus | null> {
  if (!baseUrl) return null;
  try {
    // Bounded: the publish-readiness check awaits this, and a hung deploy
    // should cost the editor a skipped warning, not a stalled panel.
    const response = await fetch(new URL("/build-info.json", baseUrl), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return parseDeployStatus(await response.json());
  } catch {
    return null;
  }
}

function parseDeployStatus(body: unknown): DeployStatus | null {
  if (typeof body !== "object" || body === null) return null;
  const { snapshotHash, builtAt, routes } = body as Record<string, unknown>;
  if (typeof snapshotHash !== "string" || typeof builtAt !== "string" || !Array.isArray(routes)) {
    return null;
  }
  const routeKeys = routes.flatMap((route) =>
    typeof route === "object" &&
    route !== null &&
    typeof (route as { routeKey?: unknown }).routeKey === "string"
      ? [(route as { routeKey: string }).routeKey]
      : [],
  );
  const routePaths = routes.flatMap((route) =>
    typeof route === "object" &&
    route !== null &&
    typeof (route as { path?: unknown }).path === "string"
      ? [(route as { path: string }).path]
      : [],
  );
  return { snapshotHash, builtAt, routeKeys, routePaths };
}

/** Published route keys absent from the deployed manifest — the plan's "pending — not in code yet". */
export function pendingRouteKeys(
  compositions: readonly { readonly routeKey: string; readonly published: boolean }[],
  deployStatus: DeployStatus | null,
): ReadonlySet<string> {
  if (!deployStatus) return new Set();
  const deployed = new Set(deployStatus.routeKeys);
  const pending = new Set<string>();
  for (const composition of compositions) {
    if (composition.published && !deployed.has(composition.routeKey)) {
      pending.add(composition.routeKey);
    }
  }
  return pending;
}
