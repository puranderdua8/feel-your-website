import { runRouteCompositionWriterContract } from "@feel-your-website/content-core/route-composition-contract-tests";
import { describe, expect, it } from "vitest";

import { MemoryContentAdapter } from "./MemoryContentAdapter.js";

/**
 * `MemoryContentAdapter` is the first `RouteCompositionWriter` to pass the
 * shared contract — the Supabase one runs the same behaviours against a live
 * database in the `supabase` CI job (`config-bundle-supabase`'s live test).
 *
 * A fresh, empty adapter per call: the suite creates and updates bundles, so
 * a shared instance would let one test's writes leak into the next.
 */
runRouteCompositionWriterContract({
  name: "MemoryContentAdapter",
  createWriter: () => new MemoryContentAdapter({ routes: [] }),
});

describe("MemoryContentAdapter route composition read/write", () => {
  it("reads back a saved draft through getComposition, and keeps it out of the manifest", async () => {
    const adapter = new MemoryContentAdapter({ routes: [] });

    const saved = await adapter.saveComposition(
      null,
      {
        name: "Pricing",
        path: "/pricing",
        published: false,
        tree: [
          {
            instanceId: crypto.randomUUID(),
            ref: { key: "hero", variant: "" },
            content: { en: { title: "Pricing" } },
            slots: {},
          },
        ],
        seo: { en: { title: "Pricing", robots: "noindex" } },
      },
      null,
      "user-1",
    );

    const composition = await adapter.getComposition(saved.id);
    expect(composition).toMatchObject({
      id: saved.id,
      name: "Pricing",
      path: "/pricing",
      published: false,
      version: 1,
    });
    expect(composition?.tree.map((n) => n.ref.key)).toEqual(["hero"]);
    expect(composition?.seo).toEqual({ en: { title: "Pricing", robots: "noindex" } });

    // Draft — not in the published manifest, but visible in the editor's list.
    expect(await adapter.getRouteManifest("en")).toEqual([]);
    expect((await adapter.listCompositions()).map((r) => r.id)).toEqual([saved.id]);

    const published = await adapter.saveComposition(
      saved.id,
      { name: "Pricing", path: "/pricing", published: true, tree: composition!.tree, seo: {} },
      saved.version,
      "user-1",
    );
    const manifest = await adapter.getRouteManifest("en");
    expect(manifest.map((b) => b.id)).toEqual([published.id]);
  });

  it("returns null for an unknown bundle id", async () => {
    const adapter = new MemoryContentAdapter({ routes: [] });
    expect(await adapter.getComposition(crypto.randomUUID())).toBeNull();
  });
});
