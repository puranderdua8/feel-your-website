import { describe, expect, it } from "vitest";

import { canonicalPathname } from "./__root.js";

describe("canonicalPathname", () => {
  it("strips a trailing slash", () => {
    expect(canonicalPathname("/blog/")).toBe("/blog");
  });

  it("leaves root alone", () => {
    expect(canonicalPathname("/")).toBe("/");
  });

  it("collapses doubled slashes", () => {
    expect(canonicalPathname("//blog//hello-world")).toBe("/blog/hello-world");
  });

  it("collapses doubled slashes and strips a trailing slash together", () => {
    expect(canonicalPathname("/blog//hello-world/")).toBe("/blog/hello-world");
  });

  it("leaves an already-canonical path alone", () => {
    expect(canonicalPathname("/blog/hello-world")).toBe("/blog/hello-world");
  });

  it("leaves case alone — an uppercase segment is a matching concern, not a redirect one", () => {
    expect(canonicalPathname("/Blog/")).toBe("/Blog");
  });
});
