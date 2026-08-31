import { describe, expect, it } from "vitest";

import { definePermissions } from "./permissions.js";
import {
  areClaimsStale,
  can,
  canAll,
  canAny,
  PermissionDeniedError,
  requirePermission,
  resolvePermissions,
} from "./resolve.js";
import type { Role } from "./types.js";

const catalog = definePermissions([
  { name: "capture:audio", description: "Record." },
  { name: "view:analytics", description: "Read dashboards." },
  { name: "manage:content", description: "Edit content." },
]);

type AppPermission = (typeof catalog.values)[number];

function role(name: string, permissions: string[]): Role<AppPermission> {
  return {
    id: name,
    name,
    permissions: permissions as AppPermission[],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("resolvePermissions", () => {
  it("unions permissions across roles", () => {
    const { permissions } = resolvePermissions(
      [role("surveyor", ["capture:audio"]), role("analyst", ["view:analytics"])],
      catalog,
    );

    expect([...permissions].sort()).toEqual(["capture:audio", "view:analytics"]);
  });

  it("deduplicates overlapping grants", () => {
    const { permissions } = resolvePermissions(
      [role("a", ["capture:audio"]), role("b", ["capture:audio"])],
      catalog,
    );

    expect(permissions.size).toBe(1);
  });

  it("drops permissions the catalog no longer defines, and reports them", () => {
    // Roles are data and the catalog is code, so role data outlives removed
    // permissions. Dropping is the fail-closed direction.
    const { permissions, unknown } = resolvePermissions(
      [role("legacy", ["capture:audio", "capture:video", "export:everything"])],
      catalog,
    );

    expect([...permissions]).toEqual(["capture:audio"]);
    expect(unknown).toEqual(["capture:video", "export:everything"]);
  });

  it("resolves an empty role list to no permissions", () => {
    const { permissions, unknown } = resolvePermissions([], catalog);
    expect(permissions.size).toBe(0);
    expect(unknown).toEqual([]);
  });
});

describe("checks", () => {
  const granted = new Set<AppPermission>(["capture:audio", "view:analytics"]);

  it("can / canAll / canAny", () => {
    expect(can(granted, "capture:audio")).toBe(true);
    expect(can(granted, "manage:content")).toBe(false);

    expect(canAll(granted, ["capture:audio", "view:analytics"])).toBe(true);
    expect(canAll(granted, ["capture:audio", "manage:content"])).toBe(false);

    expect(canAny(granted, ["manage:content", "view:analytics"])).toBe(true);
    expect(canAny(granted, ["manage:content"])).toBe(false);
  });

  it("requirePermission throws a typed error carrying the permission", () => {
    expect(() => requirePermission(granted, "capture:audio")).not.toThrow();

    try {
      requirePermission(granted, "manage:content");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).permission).toBe("manage:content");
    }
  });
});

describe("areClaimsStale", () => {
  const issued = new Date("2026-01-02T00:00:00.000Z");

  it("is stale when permissions changed after the token was issued", () => {
    expect(areClaimsStale(issued, new Date("2026-01-03T00:00:00.000Z"))).toBe(true);
  });

  it("is fresh when permissions changed before the token was issued", () => {
    expect(areClaimsStale(issued, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("is fresh when permissions have never changed", () => {
    expect(areClaimsStale(issued, null)).toBe(false);
    expect(areClaimsStale(issued, undefined)).toBe(false);
  });
});
