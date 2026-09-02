// @vitest-environment node
//
// See `auth-supabase/src/contract.test.ts`'s copy of this note: the
// workspace's default jsdom environment gives auth-js's `isBrowser()` check a
// `window` to find, which makes it open a real `BroadcastChannel` per
// session-persisting client this file signs in — and enough of those sharing
// one storage key crashes the process under Node's own
// `BroadcastChannel`/`MessageEvent` interop bug (this file's own two
// concurrently signed-in sessions is what first surfaced it). Plain Node has
// no `window`, so GoTrue never touches `BroadcastChannel` at all. The
// `storageKey` overrides below are a separate, complementary fix — quieting
// GoTrue's own "multiple clients" warning by giving the two identities
// distinct channels — kept because it is still correct, not because it is
// still load-bearing for the crash.
import { ContentAdapterError, isContentAdapterError } from "@feel-your-website/content-core";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MemoryCookieAdapter } from "./CookieAdapter.js";
import { SupabaseContentAdapter } from "./SupabaseContentAdapter.js";
import { SupabaseContentWriter } from "./SupabaseContentWriter.js";

/**
 * Runs `SupabaseContentWriter` against a real local Supabase — see
 * `contract.test.ts` (the read side) and `auth-supabase`'s live suite for the
 * sibling pattern this follows. Not part of that file because writing needs
 * a signed-in, permission-granted session; reading needs none at all — two
 * different fixtures for two genuinely different clients.
 */
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasLocalSupabase = Boolean(url && anonKey && serviceRoleKey);

if (hasLocalSupabase) {
  describe("SupabaseContentWriter (live)", () => {
    let admin: SupabaseClient;
    let editorUserId: string;
    let editorBundleId: string;
    let outsiderUserId: string;
    let reader: SupabaseContentAdapter;
    let editor: SupabaseContentWriter;
    let outsider: SupabaseContentWriter;

    const templateKey = `writer-live-${randomUUID()}`;
    const messageKey = `writer-live.${randomUUID()}`;

    beforeAll(async () => {
      admin = createClient(url!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const email = `content-writer-${randomUUID()}@example.com`;
      const password = "correct horse battery staple";
      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (userError || !userData.user) throw userError ?? new Error("createUser returned no user");
      editorUserId = userData.user.id;

      const { data: bundle, error: bundleError } = await admin
        .from("config_bundles")
        .insert({
          vocabulary: "permission",
          name: `writer-live-grant-${editorUserId}`,
          updated_by: editorUserId,
        })
        .select()
        .single();
      if (bundleError || !bundle) throw bundleError ?? new Error("bundle insert returned no row");
      editorBundleId = bundle.id as string;

      const { error: grantError } = await admin
        .from("role_permissions")
        .insert({ bundle_id: editorBundleId, permission: "manage:content" });
      if (grantError) throw grantError;

      const { error: assignError } = await admin
        .from("user_roles")
        .insert({ user_id: editorUserId, bundle_id: editorBundleId });
      if (assignError) throw assignError;

      // Distinct storage keys, deliberately: this file holds two *different*
      // real, signed-in sessions alive at once (editor and outsider), unlike
      // every other live suite's one-session-at-a-time pattern. Left at
      // GoTrue's shared default, the two clients' `BroadcastChannel`
      // cross-tab sync collided and crashed the process under Node — see
      // `SupabaseContentWriterOptions.storageKey`'s own doc for what that
      // looked like and why it is real, not a flake.
      const editorCookies = new MemoryCookieAdapter();
      const editorAuthClient = createServerClient(url!, anonKey!, {
        cookies: { getAll: () => editorCookies.getAll(), setAll: (c) => editorCookies.setAll(c) },
        auth: { storageKey: "writer-live-editor" },
      });
      const { error: signInError } = await editorAuthClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // A second, ordinary signed-in user with no `manage:content` grant —
      // proves the database refuses the write itself, not merely that the
      // CMS UI hides the button.
      const { data: outsiderUser, error: outsiderError } = await admin.auth.admin.createUser({
        email: `content-outsider-${randomUUID()}@example.com`,
        password,
        email_confirm: true,
      });
      if (outsiderError || !outsiderUser.user) throw outsiderError ?? new Error("no outsider user");
      outsiderUserId = outsiderUser.user.id;

      const outsiderCookies = new MemoryCookieAdapter();
      const outsiderAuthClient = createServerClient(url!, anonKey!, {
        cookies: {
          getAll: () => outsiderCookies.getAll(),
          setAll: (c) => outsiderCookies.setAll(c),
        },
        auth: { storageKey: "writer-live-outsider" },
      });
      const { error: outsiderSignInError } = await outsiderAuthClient.auth.signInWithPassword({
        email: outsiderUser.user.email!,
        password,
      });
      if (outsiderSignInError) throw outsiderSignInError;

      reader = new SupabaseContentAdapter({ url: url!, anonKey: anonKey!, defaultLocale: "en" });
      editor = new SupabaseContentWriter({
        url: url!,
        anonKey: anonKey!,
        cookies: editorCookies,
        storageKey: "writer-live-editor",
      });
      outsider = new SupabaseContentWriter({
        url: url!,
        anonKey: anonKey!,
        cookies: outsiderCookies,
        storageKey: "writer-live-outsider",
      });
    });

    afterAll(async () => {
      await admin.from("content_items").delete().eq("template_key", templateKey);
      await admin.from("content_messages").delete().eq("key", messageKey);
      await admin.from("user_roles").delete().eq("bundle_id", editorBundleId);
      await admin.from("config_bundles").delete().eq("id", editorBundleId);
      await admin.auth.admin.deleteUser(editorUserId);
      await admin.auth.admin.deleteUser(outsiderUserId);
    });

    it("saves an item, readable back through the ordinary anon-key adapter", async () => {
      const saved = await editor.saveContentItem(templateKey, "en", { title: "Guidance" });
      expect(saved.fields).toEqual({ title: "Guidance" });

      const read = await reader.getContent(templateKey, "en");
      expect(read?.fields).toEqual({ title: "Guidance" });
    });

    it("replaces on a second save to the same key", async () => {
      await editor.saveContentItem(templateKey, "en", { title: "Updated" });

      const read = await reader.getContent(templateKey, "en");
      expect(read?.fields).toEqual({ title: "Updated" });
    });

    it("deletes an item", async () => {
      await editor.saveContentItem(templateKey, "hi", { title: "अस्थायी" });
      expect((await reader.getContent(templateKey, "hi"))?.translated).toBe(true);

      await editor.deleteContentItem(templateKey, "hi");

      // `en` is still seeded for this key from the earlier tests, so this
      // must fall back to it rather than return null outright — the same
      // "translated: false" signal `getContent`'s own contract defines.
      const afterDelete = await reader.getContent(templateKey, "hi");
      expect(afterDelete?.locale).toBe("en");
      expect(afterDelete?.translated).toBe(false);
    });

    it("round-trips a named variant without touching the default variant", async () => {
      await editor.saveContentItem(templateKey, "en", { title: "Default" });
      await editor.saveContentItem(templateKey, "en", { title: "Star icon" }, "star");

      expect((await reader.getContent(templateKey, "en"))?.fields).toEqual({ title: "Default" });
      const starred = await reader.getContent(templateKey, "en", "star");
      expect(starred?.variant).toBe("star");
      expect(starred?.fields).toEqual({ title: "Star icon" });

      await editor.deleteContentItem(templateKey, "en", "star");
      expect(await reader.getContent(templateKey, "en", "star")).toBeNull();
      // The default variant is untouched by the variant delete.
      expect((await reader.getContent(templateKey, "en"))?.fields).toEqual({ title: "Default" });
    });

    it("saves and deletes a message", async () => {
      await editor.saveMessage("en", messageKey, "Loading…");
      expect((await reader.getMessages("en"))[messageKey]).toBe("Loading…");

      await editor.deleteMessage("en", messageKey);
      expect((await reader.getMessages("en"))[messageKey]).toBeUndefined();
    });

    it("refuses a write from a session without manage:content", async () => {
      try {
        await outsider.saveContentItem(templateKey, "en", { title: "Should not land" });
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(isContentAdapterError(error)).toBe(true);
        expect((error as ContentAdapterError).code).toBe("forbidden");
      }
    });
  });
} else {
  describe.skip("SupabaseContentWriter (live)", () => {
    it("needs SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — run `supabase start` and export them, or run this via `pnpm test:contracts` in CI", () => {
      /* skipped */
    });
  });
}
