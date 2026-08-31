/**
 * A role is a named bundle of permissions drawn from the catalog. Roles are
 * CRUD'd through the CMS, not hardcoded — the CMS's database is the single
 * source of truth for role existence and role→permission mapping.
 */
export interface Role<TPermission extends string = string> {
  id: string;
  name: string;
  permissions: readonly TPermission[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A resolved set of permissions for one subject.
 *
 * Guards check this, never a role name. Role names are labels for humans;
 * making an access decision on one reintroduces exactly the coupling the
 * catalog exists to remove — a screen would then have to know which roles
 * exist, and adding a role would mean editing code.
 */
export type PermissionSet<TPermission extends string = string> = ReadonlySet<TPermission>;

/** The outcome of resolving roles into a permission set. */
export interface ResolutionResult<TPermission extends string = string> {
  permissions: PermissionSet<TPermission>;
  /**
   * Permission strings present on the roles but absent from the catalog.
   *
   * Roles are data and the catalog is code, so data can outlive a permission
   * that has been removed. These are dropped rather than granted — failing
   * closed — and surfaced here so the caller can log them.
   */
  unknown: readonly string[];
}
