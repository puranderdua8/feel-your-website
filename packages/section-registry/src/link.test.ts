import { describe, expect, it } from "vitest";

import { classifyHref } from "./link.js";

describe("classifyHref", () => {
  const route = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

  it("classifies internal paths and normalises them", () => {
    expect(classifyHref("/about")).toEqual({
      kind: "internal",
      href: "/about",
      route: route("/about"),
    });
    expect(classifyHref("/blog/post/")).toEqual({
      kind: "internal",
      href: "/blog/post",
      route: route("/blog/post"),
    });
    expect(classifyHref("  /a//b  ")).toEqual({
      kind: "internal",
      href: "/a/b",
      route: route("/a/b"),
    });
    expect(classifyHref("/")).toEqual({ kind: "internal", href: "/", route: route("/") });
  });

  it("splits a query and fragment off an internal path for the router", () => {
    expect(classifyHref("/p/?ref=cta&x=2#sec")).toEqual({
      kind: "internal",
      href: "/p?ref=cta&x=2#sec",
      route: route("/p", "?ref=cta&x=2", "sec"),
    });
    expect(classifyHref("/p?page=2")).toMatchObject({ route: route("/p", "?page=2") });
    expect(classifyHref("/p#top")).toMatchObject({ route: route("/p", "", "top") });
    // A `#` inside the fragment stays part of it; a `?` after `#` is fragment, not query.
    expect(classifyHref("/p#a?b")).toMatchObject({ route: route("/p", "", "a?b") });
  });

  it("gives a same-page fragment or query no route", () => {
    expect(classifyHref("#section")).toEqual({ kind: "internal", href: "#section" });
    expect(classifyHref("?tab=2")).toEqual({ kind: "internal", href: "?tab=2" });
  });

  it("classifies safe absolute URLs as external", () => {
    for (const href of [
      "https://example.com/x",
      "http://example.com",
      "mailto:hi@example.com",
      "tel:+15551234567",
    ]) {
      expect(classifyHref(href)).toEqual({ kind: "external", href });
    }
  });

  it("rejects dangerous or ambiguous hrefs as unsafe", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>",
      "vbscript:msgbox",
      "//evil.example/x",
      "file:///etc/passwd",
      "ftp://host/x",
      "relative/path",
      "",
      "   ",
    ]) {
      expect(classifyHref(href)).toEqual({ kind: "unsafe", href: "" });
    }
  });

  it("is safe against non-string input", () => {
    expect(classifyHref(undefined)).toEqual({ kind: "unsafe", href: "" });
    expect(classifyHref(42)).toEqual({ kind: "unsafe", href: "" });
    expect(classifyHref({ href: "/x" })).toEqual({ kind: "unsafe", href: "" });
  });
});
