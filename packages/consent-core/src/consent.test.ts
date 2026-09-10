import { afterEach, describe, expect, it } from "vitest";

import {
  CONSENT_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  isPrivacySignalSet,
  readConsentCookie,
  readStoredConsent,
  resolveConsent,
  writeStoredConsent,
} from "./consent.js";

function clearCookies(): void {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

afterEach(() => {
  window.localStorage.clear();
  clearCookies();
});

describe("isPrivacySignalSet", () => {
  it("is true for DNT '1' or 'yes'", () => {
    expect(isPrivacySignalSet({ doNotTrack: "1" } as unknown as Navigator)).toBe(true);
    expect(isPrivacySignalSet({ doNotTrack: "yes" } as unknown as Navigator)).toBe(true);
  });

  it("is true for GPC", () => {
    expect(isPrivacySignalSet({ globalPrivacyControl: true } as unknown as Navigator)).toBe(true);
  });

  it("is false when nothing is set", () => {
    expect(isPrivacySignalSet({ doNotTrack: "0" } as unknown as Navigator)).toBe(false);
    expect(isPrivacySignalSet({} as Navigator)).toBe(false);
  });
});

describe("resolveConsent", () => {
  it("forces denied when a privacy signal is set, whatever is stored", () => {
    expect(resolveConsent("granted", true)).toBe("denied");
    expect(resolveConsent("unknown", true)).toBe("denied");
  });

  it("returns the stored value otherwise", () => {
    expect(resolveConsent("granted", false)).toBe("granted");
    expect(resolveConsent("unknown", false)).toBe("unknown");
  });
});

describe("readStoredConsent / writeStoredConsent", () => {
  it("round-trips through localStorage", () => {
    writeStoredConsent("granted");
    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("granted");
    expect(readStoredConsent()).toBe("granted");
  });

  it("also writes a cookie so SSR can read it", () => {
    writeStoredConsent("denied");
    expect(document.cookie).toContain(`${CONSENT_COOKIE_NAME}=denied`);
  });

  it("falls back to the cookie when localStorage has nothing", () => {
    document.cookie = `${CONSENT_COOKIE_NAME}=granted; path=/`;
    expect(readStoredConsent()).toBe("granted");
  });

  it("returns unknown for an absent or junk value", () => {
    expect(readStoredConsent()).toBe("unknown");
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "maybe");
    expect(readStoredConsent()).toBe("unknown");
  });
});

describe("readConsentCookie", () => {
  it("parses the choice from a raw Cookie header", () => {
    expect(readConsentCookie("a=1; fyw_consent=granted; b=2")).toBe("granted");
    expect(readConsentCookie("fyw_consent=denied")).toBe("denied");
  });

  it("returns unknown for a missing or empty header", () => {
    expect(readConsentCookie(null)).toBe("unknown");
    expect(readConsentCookie("")).toBe("unknown");
    expect(readConsentCookie("other=x")).toBe("unknown");
  });
});
