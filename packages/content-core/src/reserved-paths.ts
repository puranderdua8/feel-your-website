/**
 * Path prefixes a CMS route must never claim, because this deployment's
 * shell serves them itself — either a hand-written file route, or a public
 * or server path outside the router entirely (a static asset, the service
 * worker, a TanStack Start server function). The single source of truth for
 * both the CMS (which must refuse to author a colliding path at save time —
 * catching this only at generator/build time would be too late, since the
 * editor has already published) and, later, the route generator.
 *
 * Checked by *prefix*: reserving `/icons` also blocks `/icons/logo.png`.
 * `/` is deliberately absent — the shell hands `/` to the CMS route matcher,
 * so a CMS route at `/` is allowed.
 */
export const RESERVED_ROUTE_PREFIXES = [
  "/admin",
  "/showcase",
  "/_serverFn",
  "/sw.js",
  "/manifest.webmanifest",
  "/icons",
  "/offline-data",
  "/build-info.json",
] as const;

export function isReservedRoutePath(path: string): boolean {
  return RESERVED_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
