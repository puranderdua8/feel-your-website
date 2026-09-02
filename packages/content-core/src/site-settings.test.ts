import { describe, expect, it } from "vitest";

import { FALLBACK_SITE_LOCALES, MemorySiteSettingsStore } from "./site-settings.js";

describe("MemorySiteSettingsStore", () => {
  it("returns its seed", async () => {
    const store = new MemorySiteSettingsStore([
      { locale: "en", label: "English" },
      { locale: "hi", label: "हिन्दी" },
    ]);

    expect(await store.getLocales()).toEqual([
      { locale: "en", label: "English" },
      { locale: "hi", label: "हिन्दी" },
    ]);
  });

  it("falls back rather than returning an empty set", async () => {
    const store = new MemorySiteSettingsStore([]);
    expect(await store.getLocales()).toEqual(FALLBACK_SITE_LOCALES);

    await store.setLocales([]);
    expect(await store.getLocales()).toEqual(FALLBACK_SITE_LOCALES);
  });

  it("replaces the set wholesale on setLocales", async () => {
    const store = new MemorySiteSettingsStore();
    await store.setLocales([{ locale: "fr", label: "Français" }]);
    expect(await store.getLocales()).toEqual([{ locale: "fr", label: "Français" }]);
  });
});
