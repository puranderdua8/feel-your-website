import type {
  RouteCompositionSummary,
  RouteParamSpec,
  RouteSeo,
} from "@feel-your-website/content-core";
import {
  composeAbsolutePattern,
  findParentCycle,
  findPatternCollisions,
  isRoutePatternError,
  templatePlaceholders,
  validateRoutePattern,
} from "@feel-your-website/content-core";

/**
 * Pure route-authoring validation, shared by the CMS BFF (the authority — every
 * save runs it) and the route editor's live preview (same rules, no round
 * trip). No server-only imports, so it bundles into the browser too.
 */

/**
 * Paths this deployment's shell serves from a static file route, and which a
 * CMS route must therefore never claim. Kept in sync with (not read from —
 * the shell and CMS are separately deployed apps) `apps/shell/src/reserved-paths.ts`;
 * `/` is deliberately absent there for the same reason it is absent here — the
 * shell's `index.tsx` hands `/` to the matcher.
 */
const RESERVED_PATHS = ["/admin"] as const;

export function isReservedRoutePath(path: string): boolean {
  return (RESERVED_PATHS as readonly string[]).includes(path);
}

export interface RouteInputIssue {
  readonly field: "path" | "parent" | "params" | "seo";
  readonly message: string;
}

/** Parses an untrusted value into `RouteParamSpec[]`, dropping unusable entries. */
export function parseParams(value: unknown): RouteParamSpec[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): RouteParamSpec[] => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string" || record.name.trim() === "") return [];
    return [
      {
        name: record.name,
        label:
          typeof record.label === "string" && record.label.trim() !== ""
            ? record.label
            : record.name,
      },
    ];
  });
}

export interface ValidateRouteInputArgs {
  /** `null` for a new route. */
  readonly bundleId: string | null;
  readonly parentId: string | null;
  /** This route's own path contribution — see `RouteBundle.pathSegment`. */
  readonly pathSegment: string;
  readonly params: readonly RouteParamSpec[];
  readonly published: boolean;
  readonly seo: Readonly<Record<string, RouteSeo>>;
  /** Every route's header, this one included if it already exists. */
  readonly siblings: readonly RouteCompositionSummary[];
}

/**
 * The absolute pattern `args` would produce, or `null` if it can't be composed
 * (an unresolvable parent, or a malformed segment) — callers that only need the
 * live preview string want this without the full issue list.
 */
export function composeCandidatePath(args: {
  parentId: string | null;
  pathSegment: string;
  siblings: readonly RouteCompositionSummary[];
}): string | null {
  const parentPath = parentPathOf(args.parentId, args.siblings);
  if (args.parentId && parentPath === null) return null;
  try {
    return composeAbsolutePattern(parentPath, args.pathSegment);
  } catch {
    return null;
  }
}

function parentPathOf(
  parentId: string | null,
  siblings: readonly RouteCompositionSummary[],
): string | null {
  if (!parentId) return null;
  return siblings.find((s) => s.id === parentId)?.path ?? null;
}

/**
 * Every rule this platform enforces on a route's path/hierarchy/params/SEO
 * before it is allowed to save — the client-side mirror of what
 * `save_route_composition` enforces transactionally in Postgres (self-parent,
 * ancestor cycle, publish ordering, colliding pattern), plus checks the RPC
 * has no way to make (reserved path, param/label bookkeeping, SEO placeholders)
 * because they depend on this deployment's routes or catalog, not the DB schema.
 */
export function validateRouteInput(args: ValidateRouteInputArgs): RouteInputIssue[] {
  const issues: RouteInputIssue[] = [];
  const { bundleId, parentId, pathSegment, params, published, seo, siblings } = args;

  if (pathSegment.trim() === "") {
    issues.push({ field: "path", message: "A path is required." });
    return issues;
  }

  const byId = new Map(siblings.map((s) => [s.id, s]));
  const parent = parentId ? byId.get(parentId) : undefined;

  if (parentId) {
    if (parentId === bundleId) {
      issues.push({ field: "parent", message: "A route cannot be its own parent." });
    } else if (!parent) {
      issues.push({ field: "parent", message: "That parent route no longer exists." });
    } else if (bundleId && findParentCycle(bundleId, parentId, byId)) {
      issues.push({ field: "parent", message: "That parent would create a cycle." });
    }
  }

  // Segment shape: a root's is an absolute pattern; a child's is one bare
  // segment (composeAbsolutePattern enforces the rest — no leading `/`, no
  // embedded `/`, a valid `:name`).
  let absolutePath: string | null = null;
  try {
    absolutePath = composeAbsolutePattern(parentId ? (parent?.path ?? null) : null, pathSegment);
  } catch (error) {
    if (parentId && !parent) {
      // Already reported above; don't pile on a second, confusing message.
    } else {
      issues.push({
        field: "path",
        message: isRoutePatternError(error) ? error.message : "That path is not valid.",
      });
    }
  }

  if (absolutePath) {
    if (isReservedRoutePath(absolutePath)) {
      issues.push({
        field: "path",
        message: `"${absolutePath}" is reserved by the site itself and can't be used here.`,
      });
    }

    const collisions = findPatternCollisions(
      siblings.filter((s) => s.id !== bundleId).map((s) => s.path),
      absolutePath,
    );
    if (collisions.length > 0) {
      issues.push({
        field: "path",
        message: `"${absolutePath}" matches the same URLs as the existing route "${collisions[0]}".`,
      });
    }

    const validated = validateRoutePattern(absolutePath);
    const patternParamNames = validated.ok ? validated.pattern.paramNames : [];
    const paramNames = params.map((p) => p.name);
    const missingLabels = params.filter((p) => p.label.trim() === "");
    const extra = paramNames.filter((n) => !patternParamNames.includes(n));
    const missing = patternParamNames.filter((n) => !paramNames.includes(n));

    if (missingLabels.length > 0) {
      issues.push({
        field: "params",
        message: `Every parameter needs a label: ${missingLabels.map((p) => `:${p.name}`).join(", ")}.`,
      });
    }
    if (extra.length > 0 || missing.length > 0) {
      issues.push({
        field: "params",
        message: `The path's parameters (${patternParamNames.map((n) => `:${n}`).join(", ") || "none"}) don't match the parameter list (${paramNames.map((n) => `:${n}`).join(", ") || "none"}).`,
      });
    }

    // Publish ordering — the same invariant `save_route_composition` enforces,
    // surfaced before the round trip.
    if (published && parent && !parent.published) {
      issues.push({
        field: "path",
        message: "Publish the parent route before publishing this one.",
      });
    }
    if (!published && bundleId) {
      const publishedChild = siblings.find((s) => s.parentId === bundleId && s.published);
      if (publishedChild) {
        issues.push({
          field: "path",
          message: `Unpublish "${publishedChild.name}" (or reparent it) before un-publishing this route.`,
        });
      }
    }

    const allowedPlaceholders = new Set(paramNames);
    const seoIssues = new Set<string>();
    for (const locale of Object.values(seo)) {
      for (const value of [locale.title, locale.description, locale.canonical, locale.ogImage]) {
        if (!value) continue;
        for (const name of templatePlaceholders(value)) {
          if (!allowedPlaceholders.has(name)) seoIssues.add(name);
        }
      }
    }
    if (seoIssues.size > 0) {
      issues.push({
        field: "seo",
        message: `SEO text references {{${[...seoIssues].join("}}, {{")}}}, which isn't one of this route's parameters.`,
      });
    }
  }

  return issues;
}
