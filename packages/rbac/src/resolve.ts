import type { PermissionCatalog } from "./permissions.js";
import type { PermissionSet, ResolutionResult, Role } from "./types.js";

/** Thrown when a permission check fails. Carries the permission for logging. */
export class PermissionDeniedError extends Error {
  readonly permission: string;

  constructor(permission: string) {
    super(`Permission denied: ${permission}`);
    this.name = "PermissionDeniedError";
    this.permission = permission;
  }
}

/**
 * Resolves a subject's roles into a flat permission set.
 *
 * Validating against the catalog is the point, not a nicety: roles come from
 * the CMS, so a role can name a permission that code has since removed.
 * Unknown entries are dropped (never granted) and returned separately so the
 * caller can log the drift.
 */
export function resolvePermissions<TPermission extends string>(
  roles: readonly Role<TPermission>[],
  catalog: PermissionCatalog<TPermission>,
): ResolutionResult<TPermission> {
  const permissions = new Set<TPermission>();
  const unknown = new Set<string>();

  for (const role of roles) {
    for (const permission of role.permissions) {
      if (catalog.includes(permission)) {
        permissions.add(permission);
      } else {
        unknown.add(permission);
      }
    }
  }

  return {
    permissions,
    unknown: [...unknown].sort(),
  };
}

/** Whether the resolved set grants this permission. */
export function can<TPermission extends string>(
  permissions: PermissionSet<TPermission>,
  permission: TPermission,
): boolean {
  return permissions.has(permission);
}

/** Whether the set grants every one of these permissions. */
export function canAll<TPermission extends string>(
  permissions: PermissionSet<TPermission>,
  required: readonly TPermission[],
): boolean {
  return required.every((permission) => permissions.has(permission));
}

/** Whether the set grants at least one of these permissions. */
export function canAny<TPermission extends string>(
  permissions: PermissionSet<TPermission>,
  required: readonly TPermission[],
): boolean {
  return required.some((permission) => permissions.has(permission));
}

/**
 * Throws `PermissionDeniedError` unless the permission is granted.
 *
 * Deliberately framework-agnostic: it throws rather than redirecting or
 * rendering, so the same check works in a BFF resolver, a route guard, and a
 * server function. Wiring it into a router belongs to the app, which is what
 * keeps this package free of a router dependency.
 */
export function requirePermission<TPermission extends string>(
  permissions: PermissionSet<TPermission>,
  permission: TPermission,
): void {
  if (!permissions.has(permission)) {
    throw new PermissionDeniedError(permission);
  }
}

/**
 * Whether a token's claims are too old to be trusted for a sensitive route.
 *
 * Custom claims only refresh when a token is reissued, so a revocation can
 * lag behind the CMS edit that made it. The asymmetry matters: a user
 * briefly missing a *new* permission is low risk, while a user retaining one
 * that was just revoked is not. Callers compare the token's issued-at
 * against the subject's `permissionsUpdatedAt` and re-resolve from the
 * database when this returns true, rather than trusting the cached claim.
 */
export function areClaimsStale(
  tokenIssuedAt: Date | number,
  permissionsUpdatedAt: Date | number | null | undefined,
): boolean {
  if (permissionsUpdatedAt == null) return false;
  return new Date(tokenIssuedAt).getTime() < new Date(permissionsUpdatedAt).getTime();
}
