/**
 * Pathnames owned by a static file route under `src/routes/`, which a
 * CMS-authored route must never shadow. `loadRoutePage` refuses to match these,
 * and the CMS blocks authoring them (PR 6).
 *
 * `/` is deliberately **absent**: `routes/index.tsx` delegates to the matcher,
 * so a CMS route at `/` is allowed and takes over the home page.
 *
 * `reserved-paths.test.ts` cross-checks this list against `routeTree.gen.ts`, so
 * a new file route fails that test until its path is added here (or consciously
 * left out, like `/`).
 */
export const RESERVED_PATHS = ["/admin"] as const;

export function isReservedPath(pathname: string): boolean {
  return (RESERVED_PATHS as readonly string[]).includes(pathname);
}
