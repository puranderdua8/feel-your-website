import { contractSeed, MemoryContentAdapter } from "@feel-your-website/content-adapter-memory";
import { afterEach, describe, expect, it } from "vitest";

import { getActionInvoker, resetAdapters } from "./adapters.js";
import { resolveRoutePage } from "./resolve-route-page.js";
import { loadRouteSectionData } from "./route-page-data.js";

/**
 * End-to-end for the worked example: the `/releases` fixture route carries a
 * `release-feed` node, whose query the shell's `loadRoutePage` fan-out runs
 * against whatever `getActionInvoker()` returns. This exercises the real
 * `SECTION_QUERY_REGISTRY` and the real memory-mode seed in `adapters.ts` —
 * only the content adapter is constructed directly (to skip Supabase).
 */

const savedInvoker = process.env.ACTION_INVOKER;

afterEach(() => {
  if (savedInvoker === undefined) delete process.env.ACTION_INVOKER;
  else process.env.ACTION_INVOKER = savedInvoker;
  resetAdapters();
});

async function resolveReleasesPage() {
  const manifest = await new MemoryContentAdapter(contractSeed).getRouteManifest("en");
  const page = resolveRoutePage("/releases", manifest, "en");
  expect(page, "the memory fixtures should publish /releases").not.toBeNull();
  return page!;
}

describe("release-feed end-to-end", () => {
  it("ACTION_INVOKER=memory: the feed section gets parsed {title,url,date} data", async () => {
    process.env.ACTION_INVOKER = "memory";
    resetAdapters();

    const data = await loadRouteSectionData(await resolveReleasesPage(), getActionInvoker());

    const entry = data["releases-feed"];
    expect(entry && "ok" in entry && entry.ok).toBe(true);
    const list = (entry as { ok: true; data: unknown }).data;
    expect(Array.isArray(list)).toBe(true);
    expect((list as unknown[]).length).toBeGreaterThan(0);
    for (const item of list as unknown[]) {
      expect(item).toMatchObject({
        title: expect.any(String),
        url: expect.any(String),
        date: expect.any(String),
      });
    }
  });

  it("ACTION_INVOKER=memory: honours the section's count as the feed limit", async () => {
    process.env.ACTION_INVOKER = "memory";
    resetAdapters();

    // The fixture authors count: 5; the previewSample has 3 — so the section
    // gets min(5, 3) = 3. A direct invoke with a smaller limit clips further.
    const clipped = await getActionInvoker().invoke("feed.releases", { limit: 2 }, {});
    expect(clipped.ok).toBe(true);
    expect((clipped as { ok: true; data: unknown[] }).data).toHaveLength(2);
  });

  it("unconfigured (default): the section degrades to an error entry, page still resolves", async () => {
    delete process.env.ACTION_INVOKER;
    resetAdapters();

    const data = await loadRouteSectionData(await resolveReleasesPage(), getActionInvoker());
    expect(data["releases-feed"]).toEqual({ ok: false, error: { code: "not_found" } });
  });
});
