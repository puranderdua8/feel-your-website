import { randomUUID } from "node:crypto";

import { CONTRACT_FIXTURE, ContentAdapterError } from "@feel-your-website/content-core";
import { runContentAdapterContract } from "@feel-your-website/content-core/contract-tests";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, it } from "vitest";

import { SupabaseContentAdapter } from "./SupabaseContentAdapter.js";

/**
 * Runs the shared `ContentAdapter` contract against a real local Supabase —
 * see `auth-supabase/src/contract.test.ts` for the sibling suite and the same
 * reasoning on why this needs a live backend rather than an in-process fake:
 * a contract this adapter merely compiled against, never actually queried
 * through PostgREST, would not have caught the RLS gap Phase 4 found (a
 * published view silently returning nothing to a real visitor).
 *
 * Seeds one published route (tree + per-locale content + SEO) and some
 * `content_messages`, then tears them down.
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
// the pattern.
if (hasLocalSupabase) {
  describe("SupabaseContentAdapter (live)", () => {
    const f = CONTRACT_FIXTURE;
    const routeBundleName = "contract-test-route";
    const sectionKey = "contract-test-help";
    // A real app's message keys look like `bootstrap.loading` (see
    // supabase/seed/dev-content.sql); this one deliberately doesn't, so it
    // can't collide with that seed's rows.
    const messageKey = "contract-test.message";

    let admin: SupabaseClient;
    let routeBundleId: string;

    beforeAll(async () => {
      admin = createClient(url!, serviceRoleKey!);

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
          // `config_bundles.updated_by` carries no foreign key — any uuid is a
          // valid value here.
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

      // `getRouteManifest` reads `published_route_sections` — one root section
      // instance, with per-locale content so the view's `content` aggregation
      // is exercised, not just the `{}` path.
      const { data: instance, error: routeSectionError } = await admin
        .from("route_section_instances")
        .insert({
          bundle_id: routeBundleId,
          parent_instance_id: null,
          parent_slot: null,
          ordinal: 0,
          section_key: sectionKey,
          section_variant: "",
        })
        .select()
        .single();
      if (routeSectionError || !instance) {
        throw routeSectionError ?? new Error("route_section_instances insert returned no row");
      }

      const { error: routeContentError } = await admin.from("route_section_content").insert([
        {
          bundle_id: routeBundleId,
          instance_id: instance.id,
          locale: f.defaultLocale,
          fields: { title: "Help" },
        },
        {
          bundle_id: routeBundleId,
          instance_id: instance.id,
          locale: f.otherLocale,
          fields: { title: "मदद" },
        },
      ]);
      if (routeContentError) throw routeContentError;

      const { error: routeSeoError } = await admin.from("route_seo").insert({
        bundle_id: routeBundleId,
        locale: f.defaultLocale,
        title: "Help — contract test",
        keywords: ["help", "support"],
      });
      if (routeSeoError) throw routeSeoError;
    });

    afterAll(async () => {
      // cascades route_bundles + route_section_instances + route_section_content + route_seo
      await admin.from("config_bundles").delete().eq("id", routeBundleId);
      await admin.from("content_messages").delete().eq("key", messageKey);
    });

    runContentAdapterContract({
      name: "SupabaseContentAdapter",
      createAdapter: () => new SupabaseContentAdapter({ url: url!, anonKey: anonKey! }),
      createUnavailableAdapter: () =>
        new SupabaseContentAdapter({
          url: url!,
          anonKey: anonKey!,
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
