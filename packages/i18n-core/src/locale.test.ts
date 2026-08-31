import { describe, expect, it } from "vitest";

import {
  deLocalizePath,
  extractLocaleFromPath,
  localizePath,
  matchAcceptLanguage,
  negotiateLocale,
} from "./locale.js";

const config = {
  supported: ["en", "hi"],
  defaultLocale: "en",
} as const;

describe("negotiateLocale", () => {
  it("prefers the URL over everything else", () => {
    // A locale in the URL is a deliberate, shareable request; it must beat a
    // remembered cookie and the browser's guess.
    expect(
      negotiateLocale(config, {
        pathname: "/hi/help",
        cookie: "en",
        acceptLanguage: "en-GB,en;q=0.9",
      }),
    ).toBe("hi");
  });

  it("prefers the cookie over Accept-Language", () => {
    expect(negotiateLocale(config, { cookie: "hi", acceptLanguage: "en" })).toBe("hi");
  });

  it("ignores an unsupported cookie rather than trusting it", () => {
    expect(negotiateLocale(config, { cookie: "fr", acceptLanguage: "hi" })).toBe("hi");
  });

  it("falls back to the default when nothing matches", () => {
    expect(negotiateLocale(config, { acceptLanguage: "fr,de" })).toBe("en");
    expect(negotiateLocale(config, {})).toBe("en");
  });
});

describe("matchAcceptLanguage", () => {
  it("honours q-values rather than taking the first entry", () => {
    expect(matchAcceptLanguage(config, "en;q=0.2,hi;q=0.9")).toBe("hi");
  });

  it("falls back from a region to its base language", () => {
    // A browser asking for en-IN wants English, not the default by accident.
    expect(matchAcceptLanguage(config, "en-IN")).toBe("en");
    expect(matchAcceptLanguage(config, "hi-IN,en;q=0.5")).toBe("hi");
  });

  it("treats a wildcard as no preference", () => {
    expect(matchAcceptLanguage(config, "*")).toBe("en");
  });

  it("ignores entries explicitly refused with q=0", () => {
    expect(matchAcceptLanguage(config, "hi;q=0,en;q=0.5")).toBe("en");
  });

  it("returns null for an absent or unmatched header", () => {
    expect(matchAcceptLanguage(config, null)).toBeNull();
    expect(matchAcceptLanguage(config, "")).toBeNull();
    expect(matchAcceptLanguage(config, "fr,de")).toBeNull();
  });

  it("survives a malformed header instead of throwing", () => {
    expect(matchAcceptLanguage(config, ";;;q=")).toBeNull();
  });
});

describe("path handling", () => {
  it("extracts a locale prefix", () => {
    expect(extractLocaleFromPath("/hi/help", config)).toEqual({
      locale: "hi",
      pathname: "/help",
    });
  });

  it("reports no locale when the path carries none", () => {
    expect(extractLocaleFromPath("/help", config)).toEqual({
      locale: null,
      pathname: "/help",
    });
  });

  it("does not mistake a route segment for a locale", () => {
    expect(extractLocaleFromPath("/english/help", config).locale).toBeNull();
  });

  it("leaves the default locale unprefixed", () => {
    // Keeps the common case's URLs clean.
    expect(localizePath("/help", "en", config)).toBe("/help");
    expect(localizePath("/hi/help", "en", config)).toBe("/help");
  });

  it("prefixes a non-default locale", () => {
    expect(localizePath("/help", "hi", config)).toBe("/hi/help");
  });

  it("prefixes the default locale when configured to", () => {
    expect(localizePath("/help", "en", { ...config, prefixDefaultLocale: true })).toBe("/en/help");
  });

  it("handles the root path in both directions", () => {
    expect(localizePath("/", "hi", config)).toBe("/hi");
    expect(deLocalizePath("/hi", config)).toBe("/");
    expect(localizePath("/", "en", config)).toBe("/");
  });

  it("round-trips: localize then delocalize returns the original", () => {
    for (const path of ["/", "/help", "/library/123"]) {
      for (const locale of config.supported) {
        expect(deLocalizePath(localizePath(path, locale, config), config)).toBe(path);
      }
    }
  });
});
