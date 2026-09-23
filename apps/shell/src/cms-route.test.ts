import { afterEach, describe, expect, it, vi } from "vitest";

const loadRouteContent = vi.fn();
vi.mock("@/server/bff", () => ({ loadRouteContent: (arg: unknown) => loadRouteContent(arg) }));
vi.mock("@/generated/cms-routes.js", () => ({
  CMS_ROUTES: [
    { routeKey: "help", path: "/help", offline: true },
    { routeKey: "blog", path: "/blog", offline: false },
  ],
}));
vi.mock("@/server/offline-locale", () => ({ readOfflineLocale: () => "en" }));

const { cmsLoader } = await import("./cms-route.js");

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  loadRouteContent.mockReset();
  fetchMock.mockReset();
});

const content = {
  routeKey: "help",
  path: "/help",
  locale: "en",
  params: {},
  tree: [],
  hasOutlet: false,
  seo: {},
};

describe("cmsLoader", () => {
  it("returns the server function's content directly on success, never touching fetch", async () => {
    loadRouteContent.mockResolvedValue(content);

    const result = await cmsLoader({ params: {} }, "help");

    expect(result).toBe(content);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws notFound() when the server function returns null, even for an offline route", async () => {
    loadRouteContent.mockResolvedValue(null);

    await expect(cmsLoader({ params: {} }, "help")).rejects.toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-throws the original error for a route that isn't offline", async () => {
    const error = new TypeError("Failed to fetch");
    loadRouteContent.mockRejectedValue(error);

    await expect(cmsLoader({ params: {} }, "blog")).rejects.toBe(error);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the precached offline seed for an offline route once the network call fails", async () => {
    loadRouteContent.mockRejectedValue(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          routeKey: "help",
          path: "/help",
          tree: [{ instanceId: "n", sectionKey: "help", content: {}, slots: {} }],
          seo: { en: { title: "Help — feel-your-website" } },
          hasOutlet: false,
        }),
    });

    const result = await cmsLoader({ params: {} }, "help");

    expect(fetchMock).toHaveBeenCalledWith("/offline-data/help.json");
    expect(result).toEqual({
      routeKey: "help",
      path: "/help",
      locale: "en",
      params: {},
      tree: [{ instanceId: "n", sectionKey: "help", content: {}, slots: {} }],
      hasOutlet: false,
      seo: { title: "Help — feel-your-website" },
    });
  });

  it("re-throws the original error when the offline route has no precached seed either", async () => {
    const error = new TypeError("Failed to fetch");
    loadRouteContent.mockRejectedValue(error);
    fetchMock.mockResolvedValue({ ok: false });

    await expect(cmsLoader({ params: {} }, "help")).rejects.toBe(error);
  });

  it("re-throws the original error when fetching the offline seed itself throws", async () => {
    const error = new TypeError("Failed to fetch");
    loadRouteContent.mockRejectedValue(error);
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(cmsLoader({ params: {} }, "help")).rejects.toBe(error);
  });
});
