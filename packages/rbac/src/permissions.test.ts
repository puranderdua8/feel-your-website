import { describe, expect, it } from "vitest";

import {
  definePermissions,
  PLATFORM_PERMISSIONS,
  platformCatalog,
  SEED_ONLY_PERMISSIONS,
} from "./permissions.js";

describe("definePermissions", () => {
  const catalog = definePermissions([
    { name: "capture:audio", description: "Record a session." },
    { name: "manage:content", description: "Edit content.", group: "CMS" },
  ]);

  it("exposes names in declaration order", () => {
    expect(catalog.values).toEqual(["capture:audio", "manage:content"]);
  });

  it("narrows unknown strings", () => {
    expect(catalog.includes("capture:audio")).toBe(true);
    expect(catalog.includes("capture:video")).toBe(false);
  });

  it("looks up definitions", () => {
    expect(catalog.get("manage:content").group).toBe("CMS");
  });

  it("throws on duplicates rather than silently deduplicating", () => {
    expect(() =>
      definePermissions([
        { name: "a", description: "one" },
        { name: "a", description: "two" },
      ]),
    ).toThrow(/Duplicate permission/);
  });
});

describe("platform catalog", () => {
  it("gates only the boilerplate's own surfaces", () => {
    expect([...platformCatalog.values].sort()).toEqual([
      "manage:content",
      "manage:roles",
      "manage:routes",
      "view:audit",
    ]);
  });

  it("requires a description for every permission", () => {
    // Descriptions are rendered in the role editor and, more importantly,
    // force the author to state what a gate protects during review.
    for (const definition of PLATFORM_PERMISSIONS) {
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });

  it("marks manage:roles as seed-only", () => {
    // Never assignable through the role editor — this closes both privilege
    // escalation and lockout. The CMS enforces it; this pins the intent.
    expect(SEED_ONLY_PERMISSIONS).toContain("manage:roles");
  });
});
