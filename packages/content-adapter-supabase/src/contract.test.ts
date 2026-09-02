import { randomUUID } from "node:crypto";

import { CONTRACT_FIXTURE, ContentAdapterError } from "@feel-your-website/content-core";
import { runContentAdapterContract } from "@feel-your-website/content-core/contract-tests";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, it } from "vitest";

import { SupabaseContentAdapter } from "./SupabaseContentAdapter.js";

/**
 * Runs the shared `ContentAdapter` contract against a real local Supabase —
 * see `auth-supabase/src/contract.test.ts` for the sibling suite and the
 * same reasoning on why this needs a live backend rather than an in-process
 * fake: a contract this adapter merely compiled against, never actually
 * queried through PostgREST, would not have caught the RLS gap Phase 4 found
 * (`published_route_manifest` silently returning nothing to a real visitor).
 */
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasLocalSupabase = Boolean(url && anonKey && serviceRoleKey);

// A plain `if`, not `describe.skip(...)`, guarding the whole suite: Vitest
// still *runs* a skipped `describe`'s body to register its tests — only the
// tests themselves don't execute — so `describe.skip` alone does not protect
// work done at describe-body scope, like constructing a Supabase client.
// See `auth-supabase/src/contract.test.ts` for the incident that made this
// the pattern: a client built directly in the body ran unconditionally and
// threw synchronously the moment nobody had `SUPABASE_URL` set, breaking
// `pnpm test:contracts` for exactly the case this guard exists to handle
// gracefully.
if (hasLocalSupabase) {
  describe("SupabaseContentAdapter (live)", () => {
    const f = CONTRACT_FIXTURE;
    // A third template key, beyond the two the fixture names, so
    // `totalEnItems` (3) has something to count besides `translatedKey` and
    // `untranslatedKey`. Prefixed so it can never collide with a real
    // template key an app defines.
    const thirdKey = "contract-test-help";
    const routeBundleName = "contract-test-route";
    // Same reasoning, for `content_messages`: a real app's message keys look
    // like `bootstrap.loading` (see supabase/seed/dev-content.sql), so this
    // one deliberately doesn't — chosen the hard way once, when it collided
    // with exactly that seed's row and failed with a bare "duplicate key"
    // error that named neither file.
    const messageKey = "contract-test.message";

    let admin: SupabaseClient;
    let routeBundleId: string;

    beforeAll(async () => {
      admin = createClient(url!, serviceRoleKey!);

      // Every row states `variant` explicitly: PostgREST's bulk insert uses
      // the union of keys across the array as the column list, so once one
      // row names `variant` the rest get NULL (not the column default) and
      // trip the NOT NULL constraint.
      const { error: contentError } = await admin.from("content_items").insert([
        {
          template_key: f.translatedKey,
          variant: "",
          locale: f.defaultLocale,
          fields: { title: "Guidance" },
        },
        {
          template_key: f.translatedKey,
          variant: "",
          locale: f.otherLocale,
          fields: { title: "मार्गदर्शन" },
        },
        {
          template_key: f.untranslatedKey,
          variant: "",
          locale: f.defaultLocale,
          fields: { title: "Legal" },
        },
        { template_key: thirdKey, variant: "", locale: f.defaultLocale, fields: { title: "Help" } },
        // A named variant of `variantKey` (== `translatedKey`), default
        // locale only — exercises variant selection + locale fallback within
        // a variant.
        {
          template_key: f.variantKey,
          variant: f.variantName,
          locale: f.defaultLocale,
          fields: { title: "Guidance (short)" },
        },
      ]);
      if (contentError) throw contentError;

      const { error: messageError } = await admin.from("content_messages").insert([
        { locale: f.defaultLocale, key: messageKey, value: "Loading…" },
        { locale: f.otherLocale, key: messageKey, value: "लोड हो रहा है…" },
      ]);
      if (messageError) throw messageError;

      const { data: bundle, error: bundleError } = await admin
        .from("config_bundles")
        .insert({
          vocabulary: "template_key",
          name: routeBundleName,
          // `config_bundles.updated_by` carries no foreign key (see the
          // audit trail's own note in ..._config_bundles.sql on why history
          // must outlive what it describes) — any uuid is a valid value
          // here.
          updated_by: randomUUID(),
        })
        .select()
        .single();
      if (bundleError || !bundle) throw bundleError ?? new Error("bundle insert returned no row");
      routeBundleId = bundle.id as string;

      const { error: routeBundleError } = await admin
        .from("route_bundles")
        .insert({ bundle_id: routeBundleId, path: "/contract-test", published: true });
      if (routeBundleError) throw routeBundleError;

      const { error: routeTemplateError } = await admin
        .from("route_templates")
        .insert({ bundle_id: routeBundleId, ordinal: 0, template_key: thirdKey });
      if (routeTemplateError) throw routeTemplateError;
    });

    afterAll(async () => {
      // cascades route_bundles + route_templates
      await admin.from("config_bundles").delete().eq("id", routeBundleId);
      await admin
        .from("content_items")
        .delete()
        .in("template_key", [f.translatedKey, f.untranslatedKey, thirdKey]);
      await admin.from("content_messages").delete().eq("key", messageKey);
    });

    runContentAdapterContract({
      name: "SupabaseContentAdapter",
      createAdapter: () =>
        new SupabaseContentAdapter({
          url: url!,
          anonKey: anonKey!,
          defaultLocale: f.defaultLocale,
        }),
      createUnavailableAdapter: () =>
        new SupabaseContentAdapter({
          url: url!,
          anonKey: anonKey!,
          defaultLocale: f.defaultLocale,
          failWith: new ContentAdapterError("unavailable", "Content backend unreachable."),
        }),
    });
  });
} else {
  describe.skip("SupabaseContentAdapter (live)", () => {
    it("needs SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY — run `supabase start` and export them, or run this via `pnpm test:contracts` in CI", () => {
      /* skipped */
    });
  });
}
