import { AuthError } from "@feel-your-website/auth";
import {
  AUTH_CONTRACT_FIXTURE,
  runAuthProviderContract,
} from "@feel-your-website/auth/contract-tests";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, it } from "vitest";

import { MemoryCookieAdapter } from "./CookieAdapter.js";
import { SupabaseAuthProvider } from "./SupabaseAuthProvider.js";

/**
 * Runs the shared `AuthProvider` contract against a real local Supabase —
 * `supabase start`, not a mock of GoTrue's behaviour. See
 * `content-adapter-supabase/src/contract.test.ts` for the sibling suite and
 * why both need a live backend rather than an in-process fake.
 *
 * `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` must be
 * set. The CI `supabase` job sets them to the fixed local values `supabase
 * start` always prints; skipped locally with a clear message otherwise,
 * rather than failing on every `pnpm test:contracts` when no local stack is
 * running.
 */
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasLocalSupabase = Boolean(url && anonKey && serviceRoleKey);

// A plain `if`, not `describe.skip(...)`, guarding the whole suite: Vitest
// still *runs* a skipped `describe`'s body to register its tests — only the
// tests themselves don't execute — so `describe.skip` alone does not protect
// work done at describe-body scope, like constructing a Supabase client.
// `createClient(undefined!, undefined!, …)` learned that the hard way: it
// used to sit directly in the body and ran unconditionally, throwing
// synchronously the moment nobody had `SUPABASE_URL` set — breaking `pnpm
// test:contracts` for exactly the case this guard exists to handle
// gracefully. Gating the `describe` call itself, not just its contents,
// closes that off entirely rather than relying on every future addition to
// remember to defer its own setup into `beforeAll`.
if (hasLocalSupabase) {
  describe("SupabaseAuthProvider (live)", () => {
    const f = AUTH_CONTRACT_FIXTURE;

    // The contract asserts the *exact* permission set the fixture names
    // (`f.permissions`), not merely that some permission round-trips — so
    // the seeded row has to be named exactly that, not a per-run unique
    // string. It is deliberately not part of `platformCatalog` (see
    // packages/rbac): this suite proves claims round-trip through the real
    // hook, not that the fixture agrees with this platform's own vocabulary.
    let userId: string;
    let bundleId: string;
    let admin: SupabaseClient;

    beforeAll(async () => {
      admin = createClient(url!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: userData, error: userError } = await admin.auth.admin.createUser({
        email: f.email,
        password: f.password,
        email_confirm: true,
      });
      if (userError || !userData.user) {
        throw userError ?? new Error("createUser returned no user");
      }
      userId = userData.user.id;

      const { error: permissionError } = await admin.from("permissions").insert(
        f.permissions.map((name) => ({
          name,
          description: "Contract-test fixture permission.",
        })),
      );
      if (permissionError) throw permissionError;

      const { data: bundle, error: bundleError } = await admin
        .from("config_bundles")
        .insert({
          vocabulary: "permission",
          name: `contract-test-role-${userId}`,
          updated_by: userId,
        })
        .select()
        .single();
      if (bundleError || !bundle) throw bundleError ?? new Error("bundle insert returned no row");
      bundleId = bundle.id as string;

      const { error: grantError } = await admin
        .from("role_permissions")
        .insert(f.permissions.map((permission) => ({ bundle_id: bundleId, permission })));
      if (grantError) throw grantError;

      const { error: assignError } = await admin
        .from("user_roles")
        .insert({ user_id: userId, bundle_id: bundleId });
      if (assignError) throw assignError;
    });

    afterAll(async () => {
      // Children cascade (role_permissions, user_roles); the permission rows
      // have no dependent role left to violate their own FK by the time they
      // go.
      await admin.from("config_bundles").delete().eq("id", bundleId);
      await admin
        .from("permissions")
        .delete()
        .in("name", [...f.permissions]);
      await admin.auth.admin.deleteUser(userId);
    });

    runAuthProviderContract({
      name: "SupabaseAuthProvider",
      createProvider: () =>
        new SupabaseAuthProvider({
          url: url!,
          anonKey: anonKey!,
          cookies: new MemoryCookieAdapter(),
        }),
      createUnavailableProvider: () =>
        new SupabaseAuthProvider({
          url: url!,
          anonKey: anonKey!,
          cookies: new MemoryCookieAdapter(),
          failWith: new AuthError("unavailable", "Auth backend unreachable."),
        }),
    });
  });
} else {
  describe.skip("SupabaseAuthProvider (live)", () => {
    it("needs SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — run `supabase start` and export them, or run this via `pnpm test:contracts` in CI", () => {
      /* skipped */
    });
  });
}
