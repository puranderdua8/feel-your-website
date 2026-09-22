import {
  findInvalidSlugSegments,
  isReservedRoutePath,
  isRoutePatternError,
  parseRoutePattern,
  RoutePatternCollisionError,
  SLUG_SEGMENT_RE,
  buildRouteTrie,
  type PatternSegment,
} from "@feel-your-website/content-core";

import type { RoutesSnapshot, SnapshotRoute } from "./snapshot.js";

/**
 * Turns a validated {@link RoutesSnapshot} into the file layout `routes:generate`
 * writes under `apps/shell/src/routes/(cms)/`, per the plan's mapping table:
 *
 * | CMS route                          | Generated                                          |
 * |-------------------------------------|-----------------------------------------------------|
 * | `/about`, leaf                      | `(cms)/about.tsx`                                   |
 * | `/blog`, layout (has outlet)        | `(cms)/blog/route.tsx` + `(cms)/blog/index.tsx`     |
 * | `/blog/:slug`, child                | `(cms)/blog/$slug.tsx`                              |
 * | `/docs/:category/:page`             | `(cms)/docs/$category/$page.tsx`                    |
 * | `/`                                 | `(cms)/index.tsx`                                   |
 *
 * Deliberately general rather than table-driven: a route's file location is a
 * pure function of its own `path` (each `:name` segment becomes `$name`) and
 * its own `hasOutlet` — never of `parentKey` or of where other routes sit.
 * TanStack's directory-based nesting composes the URL from path segments
 * alone; an intermediate directory needs no `route.tsx` of its own to host a
 * deeper file.
 */

export interface GeneratedRouteFile {
  readonly routeKey: string;
  readonly source: SnapshotRoute;
  /** Relative to `apps/shell/src/routes/(cms)/`. */
  readonly relativePath: string;
  readonly kind: "leaf" | "layout";
}

/** Codegen-safety guard (plan finding 4): only values matching this ever reach generated source. */
const ROUTE_KEY_RE = SLUG_SEGMENT_RE;

function fileBaseFromSegments(segments: readonly PatternSegment[]): string {
  return segments.map((s) => (s.kind === "param" ? `$${s.value}` : s.value)).join("/");
}

/**
 * Validates `snapshot` and, if it is clean, maps it to the files
 * `routes:generate` should write. Errors are collected rather than thrown one
 * at a time, so a single `--check`/generate run reports everything wrong at
 * once. `files` is empty unless `errors` is empty — a partially-invalid
 * snapshot never produces a partial write.
 */
export function planGeneratedFiles(snapshot: RoutesSnapshot): {
  readonly files: readonly GeneratedRouteFile[];
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  const byKey = new Map(snapshot.routes.map((r) => [r.routeKey, r]));

  if (byKey.size !== snapshot.routes.length) {
    errors.push("routes.snapshot.json has a duplicate routeKey.");
  }

  const parsed = new Map<string, ReturnType<typeof parseRoutePattern>>();

  for (const route of snapshot.routes) {
    if (!ROUTE_KEY_RE.test(route.routeKey)) {
      errors.push(`route "${route.routeKey}": routeKey must match ${ROUTE_KEY_RE.source}.`);
    }

    let pattern: ReturnType<typeof parseRoutePattern>;
    try {
      pattern = parseRoutePattern(route.path);
    } catch (error) {
      errors.push(
        `route "${route.routeKey}": ${isRoutePatternError(error) ? error.message : String(error)}`,
      );
      continue;
    }
    parsed.set(route.routeKey, pattern);

    const badSlugs = findInvalidSlugSegments(pattern);
    if (badSlugs.length > 0) {
      errors.push(
        `route "${route.routeKey}" (${route.path}): segment(s) "${badSlugs.join('", "')}" must match ${SLUG_SEGMENT_RE.source}.`,
      );
    }

    if (isReservedRoutePath(route.path)) {
      errors.push(`route "${route.routeKey}": "${route.path}" collides with a reserved path.`);
    }

    const expectedParamNames = pattern.paramNames;
    const sameParams =
      route.paramNames.length === expectedParamNames.length &&
      route.paramNames.every((name, i) => name === expectedParamNames[i]);
    if (!sameParams) {
      errors.push(
        `route "${route.routeKey}": paramNames [${route.paramNames.join(", ")}] don't match the params in "${route.path}" [${expectedParamNames.join(", ")}].`,
      );
    }

    if (route.offline && route.paramNames.length > 0) {
      errors.push(`route "${route.routeKey}": an offline route cannot take path params.`);
    }

    if (route.parentKey !== null) {
      const parent = byKey.get(route.parentKey);
      if (!parent) {
        errors.push(
          `route "${route.routeKey}": parentKey "${route.parentKey}" is not in the snapshot.`,
        );
      } else if (!parent.hasOutlet) {
        errors.push(
          `route "${route.routeKey}": parent "${route.parentKey}" has no outlet, so it can't host a child route.`,
        );
      }
    }
  }

  try {
    buildRouteTrie(snapshot.routes.map((r) => ({ pattern: r.path, value: r.routeKey })));
  } catch (error) {
    if (error instanceof RoutePatternCollisionError) {
      errors.push(
        `patterns "${error.patterns[0]}" and "${error.patterns[1]}" match the same set of paths.`,
      );
    } else {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (errors.length > 0) return { files: [], errors };

  const files: GeneratedRouteFile[] = [];
  const seenPaths = new Map<string, string>();

  const addFile = (
    routeKey: string,
    relativePath: string,
    kind: "leaf" | "layout",
    source: SnapshotRoute,
  ) => {
    const existing = seenPaths.get(relativePath);
    if (existing) {
      errors.push(
        `routes "${existing}" and "${routeKey}" both generate "${relativePath}" — rename one of them.`,
      );
      return;
    }
    seenPaths.set(relativePath, routeKey);
    files.push({ routeKey, source, relativePath, kind });
  };

  for (const route of snapshot.routes) {
    const pattern = parsed.get(route.routeKey)!;
    const base = fileBaseFromSegments(pattern.segments);

    if (route.hasOutlet) {
      addFile(route.routeKey, base === "" ? "route.tsx" : `${base}/route.tsx`, "layout", route);
      addFile(route.routeKey, base === "" ? "index.tsx" : `${base}/index.tsx`, "leaf", route);
    } else {
      addFile(route.routeKey, base === "" ? "index.tsx" : `${base}.tsx`, "leaf", route);
    }
  }

  return errors.length > 0 ? { files: [], errors } : { files, errors: [] };
}
