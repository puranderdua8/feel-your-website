import { contractSeed, MemoryContentAdapter } from "@feel-your-website/content-adapter-memory";
import { afterEach, describe, expect, it } from "vitest";

import { getActionInvoker, resetAdapters } from "./adapters.js";
import { loadRouteContentSectionData } from "./route-content-data.js";
import { resolveRouteByKey, type RouteContentResult } from "./route-content.js";

/**
 * End-to-end for the worked example: the `/releases` fixture route carries a
 * `release-feed` node, whose query the shell's bundle-scoped fan-out runs
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

async function resolveReleasesBundle(): Promise<RouteContentResult> {
  const bundle = await new MemoryContentAdapter(contractSeed).getRouteByKey("releases");
  const resolved = resolveRouteByKey(bundle, "en", {});
  expect(resolved, "the memory fixtures should publish releases").not.toBe("not_found");
  expect(resolved).not.toBe("invalid_params");
  return resolved as RouteContentResult;
}

describe("release-feed end-to-end", () => {
  it("ACTION_INVOKER=memory: the feed section gets parsed {title,url,date} data", async () => {
    process.env.ACTION_INVOKER = "memory";
    resetAdapters();

    const resolved = await resolveReleasesBundle();
    const data = await loadRouteContentSectionData(
      resolved,
      resolved.bundle.path,
      "en",
      getActionInvoker(),
    );

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

    const resolved = await resolveReleasesBundle();
    const data = await loadRouteContentSectionData(
      resolved,
      resolved.bundle.path,
      "en",
      getActionInvoker(),
    );
    expect(data["releases-feed"]).toEqual({ ok: false, error: { code: "not_found" } });
  });
});
