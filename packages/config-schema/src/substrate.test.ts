import { defineTemplateKeys, findUnknownTemplateKeys } from "@feel-your-website/content-core";
import { platformCatalog, SEED_ONLY_PERMISSIONS } from "@feel-your-website/rbac";
import { describe, expect, it } from "vitest";

import { InvalidItemsError } from "./errors.js";
import { MemoryConfigBundleStore } from "./MemoryConfigBundleStore.js";
import type { ConfigBundle } from "./types.js";

/**
 * The substrate's central claim is that role↔permission and route↔template
 * management are the same pattern over different vocabularies. These tests
 * exercise both through the identical store, which is the only way that claim
 * means anything — otherwise "shared substrate" describes file layout rather
 * than behaviour.
 *
 * Note what is *not* shared: nothing here interprets a bundle. The RBAC guard
 * reads RoleBundles and the route renderer reads RouteBundles, separately, in
 * code. Only the data plumbing is common.
 */

const templateCatalog = defineTemplateKeys([
  { name: "guidance", description: "Guidance copy." },
  { name: "legal", description: "Terms and privacy." },
]);

function createRoleStore() {
  return new MemoryConfigBundleStore({
    findUnknownItems: (items) => items.filter((item) => !platformCatalog.includes(item)),
    // The privilege-escalation guard, expressed as store configuration
    // rather than as a special case inside the store.
    forbiddenItems: SEED_ONLY_PERMISSIONS,
  });
}

function createRouteStore() {
  return new MemoryConfigBundleStore({
    findUnknownItems: (items) => findUnknownTemplateKeys(templateCatalog, items),
  });
}

describe("one substrate, two vocabularies", () => {
  it("stores a RoleBundle drawn from the permission catalog", async () => {
    const store = createRoleStore();

    const bundle: ConfigBundle = await store.create(
      { name: "Content Manager", items: ["manage:content", "manage:routes"] },
      "seed",
    );

    expect([...bundle.items]).toEqual(["manage:content", "manage:routes"]);
    expect(bundle.version).toBe(1);
  });

  it("stores a RouteBundle drawn from the template catalog", async () => {
    const store = createRouteStore();

    const bundle = await store.create({ name: "Help page", items: ["guidance", "legal"] }, "seed");

    expect([...bundle.items]).toEqual(["guidance", "legal"]);
  });

  it("keeps the vocabularies apart", async () => {
    // A permission is not a template key and vice versa. The substrate is
    // shared; the vocabularies must not bleed.
    const roleStore = createRoleStore();
    const routeStore = createRouteStore();

    await expect(
      roleStore.create({ name: "Bad", items: ["guidance"] }, "seed"),
    ).rejects.toBeInstanceOf(InvalidItemsError);

    await expect(
      routeStore.create({ name: "Bad", items: ["manage:content"] }, "seed"),
    ).rejects.toBeInstanceOf(InvalidItemsError);
  });

  it("refuses to grant manage:roles through the role editor", async () => {
    // §3.6: manage:roles is seeded directly and never exposed through the
    // CMS's own editable surface. This closes privilege escalation (an
    // account granting itself broader access) and lockout (removing the only
    // account that can create roles) in one move.
    const store = createRoleStore();

    try {
      await store.create(
        { name: "Escalated", items: ["manage:content", "manage:roles"] },
        "content-manager",
      );
      expect.unreachable("manage:roles must not be assignable");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidItemsError);
      expect((error as InvalidItemsError).unknownItems).toEqual(["manage:roles"]);
    }
  });

  it("also refuses to add manage:roles by updating an existing role", async () => {
    // The obvious way around a create-time check.
    const store = createRoleStore();
    const created = await store.create(
      { name: "Content Manager", items: ["manage:content"] },
      "seed",
    );

    await expect(
      store.update(
        created.id,
        { items: ["manage:content", "manage:roles"] },
        created.version,
        "content-manager",
      ),
    ).rejects.toBeInstanceOf(InvalidItemsError);
  });

  it("audits who changed a role and what it looked like before", async () => {
    const store = createRoleStore();
    const created = await store.create(
      { name: "Content Manager", items: ["manage:content"] },
      "purander",
    );
    await store.update(
      created.id,
      { items: ["manage:content", "manage:routes"] },
      created.version,
      "someone-else",
    );

    const history = await store.history(created.id);

    expect(history.map((entry) => entry.updatedBy)).toEqual(["someone-else", "purander"]);
    expect([...(history[1]?.items ?? [])]).toEqual(["manage:content"]);
  });
});
