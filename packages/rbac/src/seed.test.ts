import { describe, expect, it } from "vitest";

import { definePermissions } from "./permissions.js";
import { assertSeedMatchesCatalog, catalogToSeedRows, catalogToSeedSql } from "./seed.js";

const catalog = definePermissions([
  { name: "manage:content", description: "Edit content.", group: "CMS" },
  { name: "capture:audio", description: "Record a session." },
  { name: "quote:test", description: "Handles an apostrophe: it's fine." },
]);

describe("catalogToSeedRows", () => {
  it("sorts by name so output is deterministic", () => {
    expect(catalogToSeedRows(catalog).map((row) => row.name)).toEqual([
      "capture:audio",
      "manage:content",
      "quote:test",
    ]);
  });

  it("represents a missing group as null rather than omitting it", () => {
    const rows = catalogToSeedRows(catalog);
    expect(rows.find((r) => r.name === "capture:audio")?.group).toBeNull();
    expect(rows.find((r) => r.name === "manage:content")?.group).toBe("CMS");
  });
});

describe("catalogToSeedSql", () => {
  const sql = catalogToSeedSql(catalog);

  it("upserts so descriptions stay current", () => {
    expect(sql).toContain("on conflict (name) do update set");
  });

  it("deletes permissions the code no longer defines", () => {
    // This is what makes the foreign key meaningful: the delete fails if a
    // role still references the removed permission, forcing a human call.
    expect(sql).toContain("delete from public.permissions where name not in (");
  });

  it("escapes apostrophes rather than producing broken SQL", () => {
    expect(sql).toContain("it''s fine");
  });

  it("marks the file as generated", () => {
    expect(sql).toContain("Do not edit by hand");
  });

  it("is deterministic across calls", () => {
    expect(catalogToSeedSql(catalog)).toBe(sql);
  });

  it("honours a custom table name", () => {
    expect(catalogToSeedSql(catalog, { table: "auth.perms" })).toContain("insert into auth.perms");
  });
});

describe("assertSeedMatchesCatalog", () => {
  it("passes for a seed generated from the same catalog", () => {
    expect(() => assertSeedMatchesCatalog(catalog, catalogToSeedSql(catalog))).not.toThrow();
  });

  it("tolerates trailing-whitespace and line-ending differences", () => {
    const sql = `${catalogToSeedSql(catalog).replace(/\n/g, "\r\n")}\n\n`;
    expect(() => assertSeedMatchesCatalog(catalog, sql)).not.toThrow();
  });

  it("fails when the catalog has gained a permission the seed lacks", () => {
    const stale = catalogToSeedSql(catalog);
    const grown = definePermissions([
      ...catalog.definitions,
      { name: "view:audit", description: "Read the audit log." },
    ]);

    expect(() => assertSeedMatchesCatalog(grown, stale)).toThrow(/out of date with the catalog/);
  });

  it("fails when only a description changed", () => {
    // Drift is not only about which permissions exist — the role editor
    // renders these descriptions, so a stale one is a stale UI.
    const stale = catalogToSeedSql(catalog);
    const reworded = definePermissions([
      { name: "manage:content", description: "Different wording.", group: "CMS" },
      { name: "capture:audio", description: "Record a session." },
      { name: "quote:test", description: "Handles an apostrophe: it's fine." },
    ]);

    expect(() => assertSeedMatchesCatalog(reworded, stale)).toThrow();
  });
});
