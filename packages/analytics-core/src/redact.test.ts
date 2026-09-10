import { describe, expect, it } from "vitest";

import { MAX_TEXT_LEN, redactPath, redactText } from "./redact.js";

describe("redactText", () => {
  it("masks an email", () => {
    expect(redactText("write to me@example.com now")).toBe("write to [email] now");
  });

  it("masks a long digit run but leaves short numbers", () => {
    expect(redactText("order 12345678 total 42")).toBe("order [number] total 42");
  });

  it("collapses whitespace and trims", () => {
    expect(redactText("  a\n\t b   c ")).toBe("a b c");
  });

  it("caps the length with an ellipsis", () => {
    const out = redactText("x".repeat(200));
    expect(out.length).toBe(MAX_TEXT_LEN);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("redactPath", () => {
  it("strips query and fragment", () => {
    expect(redactPath("/blog/hello?ref=x#top")).toBe("/blog/hello");
  });

  it("collapses a numeric id segment", () => {
    expect(redactPath("/orders/48213/items")).toBe("/orders/:id/items");
  });

  it("collapses a hex / uuid segment", () => {
    expect(redactPath("/u/9f1c2a7b4e5d6f00")).toBe("/u/:id");
    expect(redactPath("/u/1a2b3c4d-1111-2222-3333-444455556666")).toBe("/u/:id");
  });

  it("leaves ordinary slugs alone", () => {
    expect(redactPath("/blog/my-first-post")).toBe("/blog/my-first-post");
  });
});
