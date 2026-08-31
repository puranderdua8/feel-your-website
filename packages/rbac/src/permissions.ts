/**
 * A permission catalog is the closed, code-defined vocabulary of things a
 * role may be granted. Roles are data, authored in the CMS; the catalog is
 * not. Each permission names a real code path or endpoint, so a permission
 * that exists without a gate guarding it grants nothing and protects
 * nothing — which is why the catalog cannot usefully be authored as data.
 *
 * It is generic rather than a fixed union because this is a boilerplate:
 * hardcoding one project's vocabulary here would impose it on every future
 * project. Each app declares its own catalog and gets guards typed to
 * exactly its own permissions — closed within a project, open across them.
 *
 * The catalog is mirrored into Postgres by a generated seed (see `seed.ts`)
 * so `role_permissions` can carry a foreign key and RLS can join against it.
 * That mirror is one-directional and derived: code is authoritative.
 */
export interface PermissionDefinition {
  /** The wire identifier, e.g. `manage:content`. Stable — renaming is a breaking change. */
  readonly name: string;
  /**
   * What this permission actually allows. Required rather than optional: it
   * is rendered in the role editor, and writing it forces the author to say
   * what the gate protects while the change is being reviewed.
   */
  readonly description: string;
  /** Optional grouping label for the role editor's UI. */
  readonly group?: string;
}

export interface PermissionCatalog<TPermission extends string> {
  /** Every definition, in declaration order. */
  readonly definitions: readonly PermissionDefinition[];
  /** Every permission name, in declaration order. */
  readonly values: readonly TPermission[];
  /** Narrowing guard: is this arbitrary string a permission this app knows? */
  readonly includes: (value: string) => value is TPermission;
  /** Looks up a definition by name. */
  readonly get: (name: TPermission) => PermissionDefinition;
}

/**
 * Declares a permission catalog.
 *
 * ```ts
 * const catalog = definePermissions([
 *   { name: "capture:audio", description: "Record a session" },
 *   { name: "manage:content", description: "Edit and publish CMS content" },
 * ]);
 * type AppPermission = PermissionOf<typeof catalog>;
 * ```
 *
 * Throws on duplicate names: a repeated entry is a copy-paste mistake, and
 * silently deduplicating would hide it.
 */
export function definePermissions<const TDefinitions extends readonly PermissionDefinition[]>(
  definitions: TDefinitions,
): PermissionCatalog<TDefinitions[number]["name"]> {
  type TPermission = TDefinitions[number]["name"];

  const byName = new Map<string, PermissionDefinition>();
  const duplicates = new Set<string>();

  for (const definition of definitions) {
    if (byName.has(definition.name)) duplicates.add(definition.name);
    byName.set(definition.name, definition);
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate permission(s) in catalog: ${[...duplicates].sort().join(", ")}`);
  }

  return {
    definitions,
    values: definitions.map((d) => d.name) as readonly TPermission[],
    includes: (value: string): value is TPermission => byName.has(value),
    get: (name: TPermission) => {
      const found = byName.get(name);
      if (!found) throw new Error(`Unknown permission: ${name}`);
      return found;
    },
  };
}

/** Extracts the permission union from a catalog. */
export type PermissionOf<TCatalog> =
  TCatalog extends PermissionCatalog<infer TPermission> ? TPermission : never;

/**
 * Permissions the platform defines itself, because the boilerplate ships the
 * code paths they gate: the CMS's own authoring surfaces.
 *
 * `manage:roles` is seeded directly and deliberately never offered by the
 * role editor, which closes both privilege escalation (an account granting
 * itself more access) and lockout (removing the last account that can create
 * roles).
 */
export const PLATFORM_PERMISSIONS = [
  {
    name: "manage:content",
    description: "Create, edit and publish CMS content.",
    group: "CMS",
  },
  {
    name: "manage:routes",
    description: "Assign content and templates to routes.",
    group: "CMS",
  },
  {
    name: "manage:roles",
    description:
      "Create roles and assign permissions to them. Seeded only — never offered by the role editor.",
    group: "Administration",
  },
  {
    name: "view:audit",
    description: "Read the audit log of configuration changes.",
    group: "Administration",
  },
] as const satisfies readonly PermissionDefinition[];

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number]["name"];

/** The platform's own catalog. Apps typically spread it into their own. */
export const platformCatalog = definePermissions(PLATFORM_PERMISSIONS);

/**
 * Permissions that must never be assignable through the role editor.
 * Enforced by the CMS, and asserted by test.
 */
export const SEED_ONLY_PERMISSIONS: readonly string[] = ["manage:roles"];
