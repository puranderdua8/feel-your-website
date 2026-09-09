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
 * `readerFor` returns the same adapter — it implements both interfaces — so
 * the read-back assertions (`hasOutlet` on the summary) run here too.
 */
runRouteCompositionWriterContract({
  name: "MemoryContentAdapter",
  createWriter: () => new MemoryContentAdapter({ routes: [] }),
  readerFor: (writer) => writer as MemoryContentAdapter,
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
            sectionKey: "hero",
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
    expect(composition?.tree.map((n) => n.sectionKey)).toEqual(["hero"]);
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

  // `hasOutlet` on the summary is covered by the shared contract suite above
  // (via `readerFor`), against every backend rather than only this one.

  it("publishing one route leaves every other route's published flag untouched", async () => {
    const adapter = new MemoryContentAdapter({ routes: [] });
    const tree = () => [
      {
        instanceId: crypto.randomUUID(),
        sectionKey: "outlet",
        content: {},
        slots: {},
      },
    ];

    const home = await adapter.saveComposition(
      null,
      { name: "Home", path: "/home", published: true, tree: tree(), seo: {} },
      null,
      "u",
    );
    const about = await adapter.saveComposition(
      null,
      {
        name: "About",
        path: "/home/about",
        pathSegment: "about",
        parentId: home.id,
        published: true,
        tree: [{ instanceId: crypto.randomUUID(), sectionKey: "hero", content: {}, slots: {} }],
        seo: {},
      },
      null,
      "u",
    );

    // Re-save `/home` (still published, e.g. an outlet edit). `/home/about`
    // must stay exactly as it was — one save, one route.
    await adapter.saveComposition(
      home.id,
      { name: "Home", path: "/home", published: true, tree: tree(), seo: {} },
      home.version,
      "u",
    );
    let list = new Map((await adapter.listCompositions()).map((r) => [r.id, r.published]));
    expect(list.get(about.id)).toBe(true);

    // Unpublish `/home/about` (its version is unchanged — re-saving `/home`
    // never touched it). `/home` stays published.
    await adapter.saveComposition(
      about.id,
      {
        name: "About",
        path: "/home/about",
        pathSegment: "about",
        parentId: home.id,
        published: false,
        tree: [{ instanceId: crypto.randomUUID(), sectionKey: "hero", content: {}, slots: {} }],
        seo: {},
      },
      about.version,
      "u",
    );
    list = new Map((await adapter.listCompositions()).map((r) => [r.id, r.published]));
    expect(list.get(home.id)).toBe(true);
    expect(list.get(about.id)).toBe(false);
  });
});
