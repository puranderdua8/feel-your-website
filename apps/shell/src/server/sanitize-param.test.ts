import { describe, expect, it } from "vitest";

import { sanitizeParam } from "./sanitize-param.js";

describe("sanitizeParam", () => {
  const SLASH = String.fromCharCode(47);
  const BACKSLASH = String.fromCharCode(92);
  const NUL = String.fromCharCode(0);
  const SPACE = String.fromCharCode(32);

  it("accepts ordinary slugs", () => {
    expect(sanitizeParam("my-post_2.0")).toBe("my-post_2.0");
  });

  it("rejects separators, control chars, dot segments and over-long values", () => {
    expect(sanitizeParam(`a${SLASH}b`)).toBeNull();
    expect(sanitizeParam(`a${BACKSLASH}b`)).toBeNull();
    expect(sanitizeParam(`a${NUL}b`)).toBeNull();
    expect(sanitizeParam(`a${SPACE}b`)).toBeNull();
    expect(sanitizeParam("..")).toBeNull();
    expect(sanitizeParam(".")).toBeNull();
    expect(sanitizeParam("50%")).toBeNull();
    expect(sanitizeParam("x".repeat(1025))).toBeNull();
    expect(sanitizeParam("")).toBeNull();
  });
});
