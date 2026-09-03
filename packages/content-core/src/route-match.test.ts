import { describe, expect, it } from "vitest";

import {
  buildHref,
  buildRouteTrie,
  composeAbsolutePattern,
  findParentCycle,
  findPatternCollisions,
  interpolateSeo,
  interpolateTemplate,
  matchRoute,
  matchRouteInTrie,
  normalizePattern,
  normalizeRequestPath,
  paramMetaToRecord,
  parseRoutePattern,
  resolveParentChain,
  RoutePatternCollisionError,
  RoutePatternError,
  splitSegment,
  templatePlaceholders,
  validateRoutePattern,
  type MatchCandidate,
} from "./route-match.js";
import type { RouteSeo } from "./types.js";

describe("parseRoutePattern", () => {
  it("parses the root pattern to zero segments", () => {
    expect(parseRoutePattern("/")).toEqual({ raw: "/", segments: [], paramNames: [] });
  });

  it("parses a flat static path", () => {
    const parsed = parseRoutePattern("/docs/guides");
    expect(parsed.paramNames).toEqual([]);
    expect(parsed.segments).toEqual([
      { kind: "static", value: "docs" },
      { kind: "static", value: "guides" },
    ]);
  });

  it("extracts named parameters in order", () => {
    const parsed = parseRoutePattern("/docs/:category/:page");
    expect(parsed.paramNames).toEqual(["category", "page"]);
    expect(parsed.segments.map((s) => s.kind)).toEqual(["static", "param", "param"]);
  });

  it("percent-decodes static segments", () => {
    expect(parseRoutePattern("/caf%C3%A9").segments).toEqual([{ kind: "static", value: "café" }]);
  });

  it.each([
    ["a non-absolute path", "docs/x"],
    ["a trailing slash", "/docs/"],
    ["an empty segment", "/docs//x"],
    ["a bare colon", "/docs/:"],
    ["a param starting with a digit", "/docs/:1page"],
    ["a colon inside a static segment", "/docs/a:b"],
    ["a repeated parameter", "/docs/:x/:x"],
  ])("rejects %s", (_label, pattern) => {
    expect(() => parseRoutePattern(pattern)).toThrow(RoutePatternError);
  });
});

describe("validateRoutePattern", () => {
  it("returns the parsed pattern on success", () => {
    const result = validateRoutePattern("/blog/:slug");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pattern.paramNames).toEqual(["slug"]);
  });

  it("returns errors instead of throwing", () => {
    const result = validateRoutePattern("/blog/:");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/parameter name/);
  });
});

describe("normalizePattern", () => {
  it.each([
    ["/", "/"],
    ["/help", "/help"],
    ["/blog/:slug", "/blog/:param"],
    ["/docs/:category/:page", "/docs/:param/:param"],
  ])("canonicalises %s to %s", (input, expected) => {
    expect(normalizePattern(input)).toBe(expected);
  });

  it("matches the SQL regexp_replace form", () => {
    // regexp_replace(path, ':[a-z][a-zA-Z0-9_]*', ':param', 'g')
    const sql = (path: string) => path.replace(/:[a-z][a-zA-Z0-9_]*/g, ":param");
    for (const pattern of ["/a/:x", "/a/:x/b/:y", "/only-static"]) {
      expect(normalizePattern(pattern)).toBe(sql(pattern));
    }
  });

  it("throws on a malformed pattern", () => {
    expect(() => normalizePattern("/a//b")).toThrow(RoutePatternError);
  });
});

describe("composeAbsolutePattern / splitSegment", () => {
  it("returns a root route's segment unchanged", () => {
    expect(composeAbsolutePattern(null, "/blog")).toBe("/blog");
  });

  it("joins a parent pattern and a child segment", () => {
    expect(composeAbsolutePattern("/blog", ":slug")).toBe("/blog/:slug");
    expect(composeAbsolutePattern("/docs/:category", "reviews")).toBe("/docs/:category/reviews");
  });

  it("round-trips through splitSegment", () => {
    const absolute = composeAbsolutePattern("/docs/:category", ":page");
    expect(splitSegment(absolute, "/docs/:category")).toBe(":page");
    expect(splitSegment("/blog", null)).toBe("/blog");
  });

  it("rejects a multi-segment child contribution", () => {
    expect(() => composeAbsolutePattern("/blog", "a/b")).toThrow(RoutePatternError);
  });

  it("rejects a child parameter that repeats one from the parent", () => {
    expect(() => composeAbsolutePattern("/docs/:slug", ":slug")).toThrow(RoutePatternError);
  });

  it("rejects a path that is not directly under the parent", () => {
    expect(() => splitSegment("/other/x", "/blog")).toThrow(RoutePatternError);
  });
});

describe("buildRouteTrie", () => {
  it("compiles distinct patterns", () => {
    expect(() =>
      buildRouteTrie([
        { pattern: "/blog/:slug", value: 1 },
        { pattern: "/blog/latest", value: 2 },
      ]),
    ).not.toThrow();
  });

  it("throws when two patterns are identical up to param names", () => {
    expect(() =>
      buildRouteTrie([
        { pattern: "/blog/:slug", value: 1 },
        { pattern: "/blog/:id", value: 2 },
      ]),
    ).toThrow(RoutePatternCollisionError);
  });
});

describe("matchRoute", () => {
  const candidates: MatchCandidate<string>[] = [
    { pattern: "/", value: "home" },
    { pattern: "/blog/:slug", value: "post" },
    { pattern: "/blog/latest", value: "latest" },
    { pattern: "/a/:x/c", value: "axc" },
    { pattern: "/a/b/:y", value: "aby" },
    { pattern: "/x/y/z", value: "xyz" },
    { pattern: "/deadend/:x/tail", value: "dead-param" },
    { pattern: "/deadend/mid/other", value: "dead-static" },
  ];

  it("prefers a fully static pattern over a parameterised one", () => {
    const match = matchRoute("/blog/latest", candidates);
    expect(match?.value).toBe("latest");
    expect(match?.params).toEqual({});
  });

  it("falls to the parameterised pattern and binds the param", () => {
    const match = matchRoute("/blog/hello-world", candidates);
    expect(match?.value).toBe("post");
    expect(match?.params).toEqual({ slug: "hello-world" });
  });

  it("lets a static segment win at the leftmost differing position", () => {
    const match = matchRoute("/a/b/c", candidates);
    expect(match?.value).toBe("aby");
    expect(match?.params).toEqual({ y: "c" });
  });

  it("backtracks out of a dead-end static branch to a parameterised one", () => {
    // Greedy descent takes the static `deadend/mid` branch first; it dead-ends
    // at the third segment (`tail` is only under the `:x` branch), so the
    // matcher must backtrack and bind `:x` = "mid".
    const match = matchRoute("/deadend/mid/tail", candidates);
    expect(match?.value).toBe("dead-param");
    expect(match?.params).toEqual({ x: "mid" });
  });

  it("returns null when the segment count does not match", () => {
    expect(matchRoute("/blog", candidates)).toBeNull();
    expect(matchRoute("/blog/a/b", candidates)).toBeNull();
  });

  it("matches the root pattern", () => {
    expect(matchRoute("/", candidates)?.value).toBe("home");
  });

  it("normalises a trailing slash and duplicate slashes before matching", () => {
    expect(matchRoute("/blog/latest/", candidates)?.value).toBe("latest");
    expect(matchRoute("//blog//latest", candidates)?.value).toBe("latest");
  });

  it("matches a percent-decoded pathname against a decoded pattern", () => {
    const match = matchRoute("/blog/caf%C3%A9", candidates);
    expect(match?.params).toEqual({ slug: "café" });
  });

  it("returns null for an empty candidate set", () => {
    expect(matchRoute("/anything", [])).toBeNull();
  });

  it("can reuse a prebuilt trie across many pathnames", () => {
    const trie = buildRouteTrie(candidates);
    expect(matchRouteInTrie(trie, "/x/y/z")?.value).toBe("xyz");
    expect(matchRouteInTrie(trie, "/blog/other")?.params).toEqual({ slug: "other" });
  });
});

describe("resolveParentChain", () => {
  const byId = new Map(
    [
      { id: "root", parentId: null },
      { id: "mid", parentId: "root" },
      { id: "leaf", parentId: "mid" },
    ].map((node) => [node.id, node]),
  );

  it("returns the chain root-first, inclusive of the leaf", () => {
    expect(resolveParentChain(byId.get("leaf")!, byId).map((n) => n.id)).toEqual([
      "root",
      "mid",
      "leaf",
    ]);
  });

  it("truncates at a missing ancestor", () => {
    const orphan = { id: "orphan", parentId: "gone" };
    expect(resolveParentChain(orphan, new Map([["orphan", orphan]])).map((n) => n.id)).toEqual([
      "orphan",
    ]);
  });

  it("terminates on a cyclic chain", () => {
    const cyclic = new Map(
      [
        { id: "a", parentId: "b" },
        { id: "b", parentId: "a" },
      ].map((node) => [node.id, node]),
    );
    expect(resolveParentChain(cyclic.get("a")!, cyclic).map((n) => n.id)).toEqual(["b", "a"]);
  });
});

describe("findParentCycle", () => {
  const byId = new Map(
    [
      { id: "root", parentId: null },
      { id: "mid", parentId: "root" },
      { id: "leaf", parentId: "mid" },
    ].map((node) => [node.id, node]),
  );

  it("flags a self-parent", () => {
    expect(findParentCycle("mid", "mid", byId)).toBe(true);
  });

  it("flags an ancestor being reparented under its descendant", () => {
    expect(findParentCycle("root", "leaf", byId)).toBe(true);
  });

  it("allows an unrelated parent", () => {
    expect(findParentCycle("leaf", "root", byId)).toBe(false);
    expect(findParentCycle("leaf", null, byId)).toBe(false);
  });
});

describe("templating", () => {
  it("lists placeholders deduped, in first-seen order", () => {
    expect(templatePlaceholders("{{a}} then {{b}} then {{a}}")).toEqual(["a", "b"]);
  });

  it("interpolates known placeholders and reports unknown ones", () => {
    const { value, unknown } = interpolateTemplate("{{ slug }} — {{missing}}", { slug: "hello" });
    expect(value).toBe("hello — ");
    expect(unknown).toEqual(["missing"]);
  });

  it("passes a template with no placeholders through unchanged", () => {
    expect(interpolateTemplate("plain title", {})).toEqual({ value: "plain title", unknown: [] });
  });

  it("interpolates every templatable SEO field and leaves robots alone", () => {
    const seo: RouteSeo = {
      title: "{{slug}} — Blog",
      description: "About {{slug}}",
      canonical: "https://example.com/blog/{{slug}}",
      ogImage: "https://cdn.example.com/{{slug}}.png",
      keywords: ["{{slug}}", "blog"],
      robots: "index, follow",
    };
    expect(interpolateSeo(seo, { slug: "hi" })).toEqual({
      title: "hi — Blog",
      description: "About hi",
      canonical: "https://example.com/blog/hi",
      ogImage: "https://cdn.example.com/hi.png",
      keywords: ["hi", "blog"],
      robots: "index, follow",
    });
  });

  it("leaves absent SEO fields absent", () => {
    expect(interpolateSeo({ title: "{{x}}" }, { x: "y" })).toEqual({ title: "y" });
  });
});

describe("paramMetaToRecord", () => {
  it("folds a well-formed array into a record", () => {
    expect(
      paramMetaToRecord([
        { name: "slug", label: "Post slug" },
        { name: "page", label: "Page" },
      ]),
    ).toEqual({ slug: { label: "Post slug" }, page: { label: "Page" } });
  });

  it("drops junk entries and defaults a missing label to the name", () => {
    expect(paramMetaToRecord([{ name: "slug" }, { label: "no name" }, 42, null])).toEqual({
      slug: { label: "slug" },
    });
  });

  it("returns an empty record for a non-array", () => {
    expect(paramMetaToRecord(undefined)).toEqual({});
  });
});

describe("findPatternCollisions", () => {
  it("flags a pattern identical up to param names", () => {
    expect(findPatternCollisions(["/blog/:slug", "/blog/latest"], "/blog/:id")).toEqual([
      "/blog/:slug",
    ]);
  });

  it("does not flag a genuinely more specific pattern", () => {
    expect(findPatternCollisions(["/blog/:slug"], "/blog/latest")).toEqual([]);
  });

  it("skips a malformed existing pattern", () => {
    expect(findPatternCollisions(["/blog//x", "/blog/:slug"], "/blog/:id")).toEqual(["/blog/:slug"]);
  });
});

describe("buildHref", () => {
  it("fills and percent-encodes parameters", () => {
    expect(buildHref("/blog/:slug", { slug: "a b/c" })).toBe("/blog/a%20b%2Fc");
  });

  it("returns the root pattern as /", () => {
    expect(buildHref("/", {})).toBe("/");
  });

  it("throws when a parameter is missing", () => {
    expect(() => buildHref("/blog/:slug", {})).toThrow(RoutePatternError);
  });

  it("applies an injected localizePath hook", () => {
    expect(buildHref("/blog/:slug", { slug: "x" }, { localizePath: (p) => `/en${p}` })).toBe(
      "/en/blog/x",
    );
  });
});

describe("normalizeRequestPath", () => {
  it("collapses duplicate slashes and drops a trailing slash", () => {
    expect(normalizeRequestPath("//docs//guides/").pathname).toBe("/docs/guides");
  });

  it("keeps the root as /", () => {
    expect(normalizeRequestPath("/").pathname).toBe("/");
    expect(normalizeRequestPath("///").pathname).toBe("/");
  });

  it("prefixes a missing leading slash", () => {
    expect(normalizeRequestPath("docs").pathname).toBe("/docs");
  });

  it("percent-decodes each segment once", () => {
    expect(normalizeRequestPath("/caf%C3%A9").pathname).toBe("/café");
  });

  it("applies an injected locale-segment splitter", () => {
    const result = normalizeRequestPath("/hi/help", {
      stripLocaleSegment: (pathname) =>
        pathname.startsWith("/hi/")
          ? { locale: "hi", pathname: pathname.slice(3) }
          : { locale: null, pathname },
    });
    expect(result).toEqual({ locale: "hi", pathname: "/help" });
  });
});
