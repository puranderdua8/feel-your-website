// @vitest-environment node
//
// See `auth-supabase/src/contract.test.ts`'s copy of this note: the
// workspace's default jsdom environment gives auth-js's `isBrowser()` check a
// `window` to find, which makes it open a real `BroadcastChannel` per
// session-persisting client this file signs in — and enough of those sharing
// one storage key crashes the process under Node's own
// `BroadcastChannel`/`MessageEvent` interop bug. Plain Node has no `window`,
// so GoTrue never touches `BroadcastChannel` at all.
import { ConfigConflictError, InvalidItemsError } from "@feel-your-website/config-schema";
import { flattenTree } from "@feel-your-website/content-core";
import { platformCatalog, SEED_ONLY_PERMISSIONS } from "@feel-your-website/rbac";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MemoryCookieAdapter, type CookieRecord } from "./CookieAdapter.js";
import { SupabaseConfigBundleStore } from "./SupabaseConfigBundleStore.js";
import { SupabaseRouteCompositionWriter } from "./SupabaseRouteCompositionWriter.js";

/**
 * Runs against a real local Supabase — see `content-adapter-supabase` and
 * `auth-supabase`'s own `contract.test.ts` for the sibling live suites and
 * why each needs one.
 *
 * This one is *not* `runConfigBundleStoreContract` against this store, and
 * that is deliberate, not an oversight: that shared contract asserts a
 * caller-supplied `actor` string round-trips into `updatedBy` verbatim.
 * `MemoryConfigBundleStore` can promise that because it trusts whatever
 * string it is given. `SupabaseConfigBundleStore` cannot and must not — its
 * RPCs derive the writer from the signed-in session's `auth.uid()`
 * specifically so a client cannot claim a write was made by someone else.
 * The two are different, incompatible notions of "actor", and running the
 * shared suite here would either fail honestly or force a change that
 * weakens what `MemoryConfigBundleStore` guarantees everywhere else it is
 * used. This file exercises the same behaviours — versioning, conflict
 * detection, vocabulary validation, deletion, audit history — with
 * assertions that fit a backend where the actor is the session, not an
 * argument.
 */
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasLocalSupabase = Boolean(url && anonKey && serviceRoleKey);

// See the sibling packages' contract.test.ts for why this is a plain `if`
// around the whole `describe`, not `describe.skip`: a skipped describe's body
// still runs at collection time, so anything built directly in it (a
// Supabase client, a seeded fixture) executes unconditionally.
if (hasLocalSupabase) {
  describe("SupabaseConfigBundleStore (live)", () => {
    let admin: SupabaseClient;
    let userId: string;
    let grantBundleId: string;
    let sessionCookies: CookieRecord[];

    const email = `config-bundle-store-${randomUUID()}@example.com`;
    const password = "correct horse battery staple";

    beforeAll(async () => {
      admin = createClient(url!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (userError || !userData.user) throw userError ?? new Error("createUser returned no user");
      userId = userData.user.id;

      // Grants every permission this file's tests need to one user, so one
      // signed-in session can exercise role bundles, route bundles, and
      // reading their audit history. `view:audit` gates
      // `config_bundle_versions` separately from `manage:roles` /
      // `manage:routes` (see `..._bundle_read_policies.sql`) — the first
      // version of this fixture granted only the latter two and got back an
      // empty `history()` for a bundle that demonstrably had one, from RLS
      // silently hiding rows rather than a store bug. All three are real
      // platform permissions, seeded by `supabase/seed/permissions.sql`
      // already — nothing to insert into `permissions` itself.
      const { data: bundle, error: bundleError } = await admin
        .from("config_bundles")
        .insert({
          vocabulary: "permission",
          name: `live-test-grant-${userId}`,
          updated_by: userId,
        })
        .select()
        .single();
      if (bundleError || !bundle) throw bundleError ?? new Error("bundle insert returned no row");
      grantBundleId = bundle.id as string;

      const { error: grantError } = await admin.from("role_permissions").insert([
        { bundle_id: grantBundleId, permission: "manage:roles" },
        { bundle_id: grantBundleId, permission: "manage:routes" },
        { bundle_id: grantBundleId, permission: "view:audit" },
      ]);
      if (grantError) throw grantError;

      const { error: assignError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, bundle_id: grantBundleId });
      if (assignError) throw assignError;

      // Signed in once, after the grant exists: `has_permission()` reads the
      // *token's* claims, stamped by the auth hook at sign-in — granting the
      // role after this point would not show up until a fresh token.
      const cookies = new MemoryCookieAdapter();
      const authClient = createServerClient(url!, anonKey!, {
        cookies: {
          getAll: () => cookies.getAll(),
          setAll: (c) => cookies.setAll(c),
        },
      });
      const { error: signInError } = await authClient.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      sessionCookies = cookies.getAll();
    });

    afterAll(async () => {
      // Sweeps every bundle this file's stores created, whatever namespace
      // each test's `freshStore()` call minted — see that helper.
      await admin.from("config_bundles").delete().like("name", "live-test-%");
      await admin.from("user_roles").delete().eq("bundle_id", grantBundleId);
      await admin.from("config_bundles").delete().eq("id", grantBundleId);
      await admin.auth.admin.deleteUser(userId);
    });

    /**
     * A store scoped to a fresh random namespace, so this test's bundle
     * names ("One", "Two", ...) cannot collide with another test's — or
     * another run's — rows in the same shared tables. See
     * `SupabaseConfigBundleStoreOptions.namespace`.
     */
    function freshStore(): SupabaseConfigBundleStore {
      const cookies = new MemoryCookieAdapter();
      cookies.setAll(sessionCookies.map((cookie) => ({ ...cookie, options: {} })));

      return new SupabaseConfigBundleStore({
        url: url!,
        anonKey: anonKey!,
        cookies,
        vocabulary: "permission",
        namespace: `live-test-${randomUUID()}-`,
        findUnknownItems: (items) => items.filter((item) => !platformCatalog.includes(item)),
        forbiddenItems: SEED_ONLY_PERMISSIONS,
      });
    }

    describe("role bundles", () => {
      it("creates a bundle at version 1, authored by the signed-in session", async () => {
        const store = freshStore();

        const bundle = await store.create(
          { name: "Content Manager", items: ["manage:content"] },
          "ignored — see the class doc",
        );

        expect(bundle.version).toBe(1);
        expect(bundle.updatedBy).toBe(userId);
        expect(bundle.name).toBe("Content Manager");
        expect([...bundle.items]).toEqual(["manage:content"]);
      });

      it("rejects an item outside the platform catalog", async () => {
        const store = freshStore();

        await expect(
          store.create({ name: "Bad", items: ["not:a:real:permission"] }, "x"),
        ).rejects.toBeInstanceOf(InvalidItemsError);
      });

      it("refuses manage:roles even though it is valid vocabulary — the privilege-escalation guard", async () => {
        const store = freshStore();

        try {
          await store.create({ name: "Escalated", items: ["manage:content", "manage:roles"] }, "x");
          expect.unreachable("manage:roles must not be assignable");
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidItemsError);
          expect((error as InvalidItemsError).unknownItems).toEqual(["manage:roles"]);
        }
      });

      it("updates in place, incrementing the version and keeping the same authored-by", async () => {
        const store = freshStore();
        const created = await store.create({ name: "One", items: ["manage:content"] }, "x");

        const updated = await store.update(
          created.id,
          { items: ["manage:content", "view:audit"] },
          created.version,
          "x",
        );

        expect(updated.version).toBe(2);
        expect(updated.updatedBy).toBe(userId);
        expect([...updated.items].sort()).toEqual(["manage:content", "view:audit"]);
      });

      it("rejects a write based on a stale version", async () => {
        const store = freshStore();
        const created = await store.create({ name: "One", items: ["manage:content"] }, "x");
        await store.update(created.id, { items: ["view:audit"] }, created.version, "x");

        try {
          await store.update(created.id, { items: ["manage:routes"] }, created.version, "x");
          expect.unreachable("should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigConflictError);
          const conflict = error as ConfigConflictError;
          expect(conflict.expectedVersion).toBe(created.version);
          expect(conflict.actualVersion).toBe(created.version + 1);
        }
      });

      it("deletes, after which get() returns null", async () => {
        const store = freshStore();
        const created = await store.create({ name: "One", items: ["manage:content"] }, "x");

        await store.delete(created.id, created.version, "x");

        await expect(store.get(created.id)).resolves.toBeNull();
      });

      it("records history, newest first, including the deletion", async () => {
        const store = freshStore();
        const created = await store.create({ name: "One", items: ["manage:content"] }, "x");
        const updated = await store.update(
          created.id,
          { items: ["view:audit"] },
          created.version,
          "x",
        );
        await store.delete(updated.id, updated.version, "x");

        const history = await store.history(created.id);

        expect(history.map((entry) => entry.action)).toEqual(["deleted", "updated", "created"]);
        expect(history.every((entry) => entry.updatedBy === userId)).toBe(true);
      });

      it("lists only the bundles this store's own namespace created", async () => {
        const storeA = freshStore();
        const storeB = freshStore();
        await storeA.create({ name: "One", items: ["manage:content"] }, "x");
        await storeB.create({ name: "One", items: ["view:audit"] }, "x");

        // Same literal name in both — proves the two stores did not collide
        // on `config_bundles`' `unique (vocabulary, name)` constraint, and
        // that each only lists its own.
        expect((await storeA.list()).map((b) => b.name)).toEqual(["One"]);
        expect((await storeB.list()).map((b) => b.name)).toEqual(["One"]);
      });

      it("reports not_found for an unknown id", async () => {
        const store = freshStore();

        await expect(store.update(randomUUID(), { name: "x" }, 1, "x")).rejects.toMatchObject({
          code: "not_found",
        });
      });
    });
  });

  describe("SupabaseRouteCompositionWriter (live)", () => {
    let admin: SupabaseClient;
    let userId: string;
    let grantBundleId: string;
    let sessionCookies: CookieRecord[];

    const email = `route-composition-writer-${randomUUID()}@example.com`;
    const password = "correct horse battery staple";

    beforeAll(async () => {
      admin = createClient(url!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (userError || !userData.user) throw userError ?? new Error("createUser returned no user");
      userId = userData.user.id;

      const { data: bundle, error: bundleError } = await admin
        .from("config_bundles")
        .insert({
          vocabulary: "permission",
          name: `live-test-rcw-grant-${userId}`,
          updated_by: userId,
        })
        .select()
        .single();
      if (bundleError || !bundle) throw bundleError ?? new Error("bundle insert returned no row");
      grantBundleId = bundle.id as string;

      const { error: grantError } = await admin
        .from("role_permissions")
        .insert({ bundle_id: grantBundleId, permission: "manage:routes" });
      if (grantError) throw grantError;

      const { error: assignError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, bundle_id: grantBundleId });
      if (assignError) throw assignError;

      const cookies = new MemoryCookieAdapter();
      const authClient = createServerClient(url!, anonKey!, {
        cookies: { getAll: () => cookies.getAll(), setAll: (c) => cookies.setAll(c) },
      });
      const { error: signInError } = await authClient.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      sessionCookies = cookies.getAll();
    });

    afterAll(async () => {
      await admin.from("config_bundles").delete().like("name", "live-test-rcw-%");
      await admin.from("user_roles").delete().eq("bundle_id", grantBundleId);
      await admin.from("config_bundles").delete().eq("id", grantBundleId);
      await admin.auth.admin.deleteUser(userId);
    });

    function writer(): SupabaseRouteCompositionWriter {
      const cookies = new MemoryCookieAdapter();
      cookies.setAll(sessionCookies.map((cookie) => ({ ...cookie, options: {} })));
      return new SupabaseRouteCompositionWriter({ url: url!, anonKey: anonKey!, cookies });
    }

    it("creates a route from a nested tree, then updates it in place", async () => {
      const w = writer();
      const cardId = randomUUID();
      const iconId = randomUUID();
      const path = `/live-test-rcw-${randomUUID()}`;

      const created = await w.saveComposition(
        null,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path,
          published: true,
          tree: [
            {
              instanceId: cardId,
              sectionKey: "card",
              content: { en: { heading: "Card" } },
              slots: {
                icon: [
                  {
                    instanceId: iconId,
                    sectionKey: "icon",
                    content: { en: { name: "star" } },
                    slots: {},
                  },
                ],
              },
            },
          ],
          seo: {
            en: { title: "Card page", description: "A card.", keywords: ["a", "b"] },
            hi: { title: "कार्ड" },
          },
        },
        null,
        "ignored — the RPC uses the session",
      );

      expect(created.version).toBe(1);
      expect(flattenTree(created.tree)).toEqual(["card", "icon"]);

      // The recursive insert actually wrote a parent and a slot child.
      const { data: rows, error } = await admin
        .from("route_section_instances")
        .select("id, parent_instance_id, parent_slot, section_key, ordinal")
        .eq("bundle_id", created.id);
      if (error) throw error;

      expect(rows).toHaveLength(2);
      const root = rows!.find((r) => r.parent_instance_id === null)!;
      const child = rows!.find((r) => r.parent_instance_id !== null)!;
      expect(root).toMatchObject({ id: cardId, section_key: "card", parent_slot: null });
      expect(child).toMatchObject({
        id: iconId,
        parent_instance_id: cardId,
        parent_slot: "icon",
        section_key: "icon",
      });

      // Each node's per-locale content was persisted alongside its instance,
      // at the root and inside the slot.
      const { data: content, error: contentError } = await admin
        .from("route_section_content")
        .select("instance_id, locale, fields")
        .eq("bundle_id", created.id);
      if (contentError) throw contentError;
      expect(content).toEqual(
        expect.arrayContaining([
          { instance_id: cardId, locale: "en", fields: { heading: "Card" } },
          { instance_id: iconId, locale: "en", fields: { name: "star" } },
        ]),
      );
      expect(content).toHaveLength(2);

      // SEO rows landed too — one per locale, `keywords` as a text[], missing
      // fields as NULL.
      const { data: seo, error: seoError } = await admin
        .from("route_seo")
        .select("locale, title, description, keywords, robots")
        .eq("bundle_id", created.id)
        .order("locale");
      if (seoError) throw seoError;
      expect(seo).toEqual([
        {
          locale: "en",
          title: "Card page",
          description: "A card.",
          keywords: ["a", "b"],
          robots: null,
        },
        { locale: "hi", title: "कार्ड", description: null, keywords: null, robots: null },
      ]);

      const updated = await w.saveComposition(
        created.id,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path,
          published: true,
          tree: [
            {
              instanceId: randomUUID(),
              sectionKey: "hero",
              content: { en: { title: "Hero" } },
              slots: {},
            },
          ],
          seo: { en: { robots: "noindex" } },
        },
        created.version,
        "x",
      );

      expect(updated.version).toBe(2);
      expect(flattenTree(updated.tree)).toEqual(["hero"]);

      const { count } = await admin
        .from("route_section_instances")
        .select("*", { count: "exact", head: true })
        .eq("bundle_id", created.id);
      expect(count).toBe(1);

      // The whole SEO set was replaced: the two old locales are gone, only
      // the new single row remains.
      const { data: seoAfter } = await admin
        .from("route_seo")
        .select("locale, robots")
        .eq("bundle_id", created.id);
      expect(seoAfter).toEqual([{ locale: "en", robots: "noindex" }]);

      // Replacing the tree cascaded the old content away and wrote the new
      // node's — nothing from the card/icon pair survives.
      const { data: afterUpdate } = await admin
        .from("route_section_content")
        .select("locale, fields")
        .eq("bundle_id", created.id);
      expect(afterUpdate).toEqual([{ locale: "en", fields: { title: "Hero" } }]);
    });

    it("rejects a write against a stale version", async () => {
      const w = writer();
      const path = `/live-test-rcw-${randomUUID()}`;
      const name = () => `live-test-rcw-${randomUUID()}`;

      const created = await w.saveComposition(
        null,
        { name: name(), path, published: false, tree: root("hero"), seo: {} },
        null,
        "x",
      );
      await w.saveComposition(
        created.id,
        { name: name(), path, published: false, tree: root("footer"), seo: {} },
        created.version,
        "x",
      );

      await expect(
        w.saveComposition(
          created.id,
          { name: name(), path, published: false, tree: root("hero"), seo: {} },
          created.version,
          "x",
        ),
      ).rejects.toMatchObject({ code: "conflict" });
    });

    it("deletes a route and its section rows, version-checked", async () => {
      const w = writer();
      const path = `/live-test-rcw-${randomUUID()}`;
      const created = await w.saveComposition(
        null,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path,
          published: true,
          tree: [
            {
              instanceId: randomUUID(),
              sectionKey: "hero",
              content: { en: { title: "Hero" } },
              slots: {},
            },
          ],
          seo: { en: { title: "Hero" } },
        },
        null,
        "x",
      );

      await expect(w.deleteComposition(created.id, created.version + 5, "x")).rejects.toMatchObject(
        {
          code: "conflict",
        },
      );

      await w.deleteComposition(created.id, created.version, "x");

      const [{ count: instanceCount }, { count: contentCount }, { count: seoCount }] =
        await Promise.all([
          admin
            .from("route_section_instances")
            .select("*", { count: "exact", head: true })
            .eq("bundle_id", created.id),
          admin
            .from("route_section_content")
            .select("*", { count: "exact", head: true })
            .eq("bundle_id", created.id),
          admin
            .from("route_seo")
            .select("*", { count: "exact", head: true })
            .eq("bundle_id", created.id),
        ]);
      expect(instanceCount).toBe(0);
      expect(contentCount).toBe(0);
      expect(seoCount).toBe(0);

      await expect(w.deleteComposition(created.id, 1, "x")).rejects.toMatchObject({
        code: "not_found",
      });
    });

    it("composes a nested route's path and round-trips its parent + params", async () => {
      const w = writer();
      const seg = `live-test-rcw-${randomUUID()}`;
      const parent = await w.saveComposition(
        null,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path: `/${seg}`,
          published: true,
          tree: root("hero"),
          seo: {},
        },
        null,
        "x",
      );

      const child = await w.saveComposition(
        null,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path: `/${seg}/:slug`,
          pathSegment: ":slug",
          parentId: parent.id,
          params: [{ name: "slug", label: "Slug" }],
          published: true,
          tree: root("help"),
          seo: {},
        },
        null,
        "x",
      );

      const { data: row } = await admin
        .from("route_bundles")
        .select("path, path_segment, normalized_path, parent_bundle_id, param_meta")
        .eq("bundle_id", child.id)
        .single();
      expect(row).toMatchObject({
        path: `/${seg}/:slug`,
        path_segment: ":slug",
        normalized_path: `/${seg}/:param`,
        parent_bundle_id: parent.id,
        param_meta: [{ name: "slug", label: "Slug" }],
      });

      await w.deleteSubtree(parent.id, parent.version, "x");
      const { count } = await admin
        .from("route_bundles")
        .select("*", { count: "exact", head: true })
        .in("bundle_id", [parent.id, child.id]);
      expect(count).toBe(0);
    });

    it("rejects a parent cycle and a live child under a draft parent", async () => {
      const w = writer();
      const seg = `live-test-rcw-${randomUUID()}`;
      const parent = await w.saveComposition(
        null,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path: `/${seg}`,
          published: false,
          tree: root("hero"),
          seo: {},
        },
        null,
        "x",
      );

      // Live child under a draft parent.
      await expect(
        w.saveComposition(
          null,
          {
            name: `live-test-rcw-${randomUUID()}`,
            path: `/${seg}/:slug`,
            pathSegment: ":slug",
            parentId: parent.id,
            params: [{ name: "slug", label: "Slug" }],
            published: true,
            tree: root("help"),
            seo: {},
          },
          null,
          "x",
        ),
      ).rejects.toMatchObject({ code: "invalid" });

      // Make both a draft chain, then try to point the parent at its own child.
      const child = await w.saveComposition(
        null,
        {
          name: `live-test-rcw-${randomUUID()}`,
          path: `/${seg}/child`,
          pathSegment: "child",
          parentId: parent.id,
          published: false,
          tree: root("help"),
          seo: {},
        },
        null,
        "x",
      );
      await expect(
        w.saveComposition(
          parent.id,
          {
            name: `live-test-rcw-${randomUUID()}`,
            path: `/${seg}`,
            pathSegment: `/${seg}`,
            parentId: child.id,
            published: false,
            tree: root("hero"),
            seo: {},
          },
          parent.version,
          "x",
        ),
      ).rejects.toMatchObject({ code: "invalid" });

      await w.deleteSubtree(parent.id, parent.version, "x");
    });

    function root(key: string) {
      return [{ instanceId: randomUUID(), sectionKey: key, content: {}, slots: {} }];
    }
  });
} else {
  describe.skip("SupabaseConfigBundleStore (live)", () => {
    it("needs SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — run `supabase start` and export them, or run this via `pnpm test:contracts` in CI", () => {
      /* skipped */
    });
  });
}
