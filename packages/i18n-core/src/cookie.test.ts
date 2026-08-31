import { afterEach, describe, expect, it } from "vitest";

import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  readLocaleCookie,
  serializeLocaleCookie,
} from "./cookie.js";

afterEach(() => {
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
});

describe("serializeLocaleCookie", () => {
  it("persists for a year so the choice outlives closing the app", () => {
    // The whole point: choose Hindi today, come back tomorrow, still Hindi.
    expect(serializeLocaleCookie("hi")).toContain(`Max-Age=${LOCALE_COOKIE_MAX_AGE}`);
    expect(LOCALE_COOKIE_MAX_AGE).toBeGreaterThanOrEqual(60 * 60 * 24 * 365);
  });

  it("scopes to the whole site", () => {
    // A narrower path would create a second cookie on other routes and make
    // the choice look like it failed to save.
    expect(serializeLocaleCookie("hi")).toContain("Path=/");
  });

  it("sets SameSite=Lax", () => {
    expect(serializeLocaleCookie("hi")).toContain("SameSite=Lax");
  });

  it("is not httpOnly, because the client renders the current choice", () => {
    expect(serializeLocaleCookie("hi")).not.toContain("HttpOnly");
  });

  it("encodes the value", () => {
    expect(serializeLocaleCookie("en-IN")).toContain(`${LOCALE_COOKIE}=en-IN`);
  });
});

describe("readLocaleCookie", () => {
  it("reads a locale the browser is holding", () => {
    document.cookie = serializeLocaleCookie("hi");
    expect(readLocaleCookie()).toBe("hi");
  });

  it("returns null when nothing is stored", () => {
    expect(readLocaleCookie()).toBeNull();
  });

  it("finds the locale among other cookies", () => {
    document.cookie = "theme=dark; path=/";
    document.cookie = serializeLocaleCookie("hi");
    document.cookie = "session=abc; path=/";

    expect(readLocaleCookie()).toBe("hi");
  });

  it("does not match a cookie whose name merely contains the key", () => {
    document.cookie = "user_locale_pref=fr; path=/";
    expect(readLocaleCookie()).toBeNull();
  });
});
