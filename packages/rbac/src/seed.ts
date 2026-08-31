import type { PermissionCatalog, PermissionDefinition } from "./permissions.js";

/**
 * Generates the Postgres mirror of the permission catalog.
 *
 * The catalog is code and stays authoritative. This emits a one-directional,
 * derived copy so the database can do things code cannot: `role_permissions`
 * carries a foreign key into `permissions`, so Postgres itself rejects a role
 * referencing a permission that no longer exists, and RLS policies can join
 * against it. The role editor also reads descriptions and groups from here.
 *
 * Because it is derived, it must never be edited by hand — CI regenerates it
 * and fails on drift (see `assertSeedMatchesCatalog`).
 */

export interface PermissionSeedRow {
  name: string;
  description: string;
  group: string | null;
}

/** The catalog as stable, sorted rows. Sorted so output is deterministic. */
export function catalogToSeedRows<TPermission extends string>(
  catalog: PermissionCatalog<TPermission>,
): PermissionSeedRow[] {
  return [...catalog.definitions]
    .map((definition: PermissionDefinition) => ({
      name: definition.name,
      description: definition.description,
      group: definition.group ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function quote(value: string | null): string {
  if (value === null) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Emits the SQL that reconciles the `permissions` table with the catalog.
 *
 * Deliberately a full reconcile rather than plain inserts: an upsert keeps
 * descriptions current, and the trailing delete removes permissions that
 * code has dropped. That delete is what makes the foreign key meaningful —
 * it will fail loudly if a role still references the removed permission,
 * which is the correct outcome: someone must decide what happens to that
 * role rather than have access silently change.
 */
export function catalogToSeedSql<TPermission extends string>(
  catalog: PermissionCatalog<TPermission>,
  options: { table?: string } = {},
): string {
  const table = options.table ?? "public.permissions";
  const rows = catalogToSeedRows(catalog);

  const values = rows
    .map((row) => `  (${quote(row.name)}, ${quote(row.description)}, ${quote(row.group)})`)
    .join(",\n");

  const names = rows.map((row) => quote(row.name)).join(", ");

  return [
    "-- Generated from the permission catalog in @feel-your-website/rbac.",
    "-- Do not edit by hand: regenerate with catalogToSeedSql().",
    "",
    `insert into ${table} (name, description, "group") values`,
    values,
    "on conflict (name) do update set",
    "  description = excluded.description,",
    '  "group" = excluded."group";',
    "",
    "-- Remove permissions the code no longer defines. Fails if a role still",
    "-- references one, which is intended: that needs a human decision.",
    `delete from ${table} where name not in (${names});`,
    "",
  ].join("\n");
}

/**
 * Throws if a checked-in seed file no longer matches the catalog.
 *
 * The mirror's one real weakness is drift, so CI asserts the invariant
 * rather than trusting that whoever changed the catalog remembered to
 * regenerate.
 */
export function assertSeedMatchesCatalog<TPermission extends string>(
  catalog: PermissionCatalog<TPermission>,
  seedSql: string,
  options: { table?: string } = {},
): void {
  const expected = catalogToSeedSql(catalog, options);
  if (normalise(seedSql) !== normalise(expected)) {
    throw new Error(
      "Permission seed is out of date with the catalog. Regenerate it with catalogToSeedSql().",
    );
  }
}

function normalise(sql: string): string {
  return sql.replace(/\r\n/g, "\n").trim();
}
