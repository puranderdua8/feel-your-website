import { describe, expect, it } from "vitest";

import { ContentAdapterError, isContentAdapterError } from "./errors.js";

describe("ContentAdapterError", () => {
  it("marks transport failures retryable", () => {
    // The UI decides whether to offer a retry affordance from this flag
    // alone, so it has to be derived from the code rather than set by hand
    // at each throw site.
    expect(new ContentAdapterError("unavailable", "x").retryable).toBe(true);
    expect(new ContentAdapterError("timeout", "x").retryable).toBe(true);
  });

  it("marks caller errors non-retryable", () => {
    expect(new ContentAdapterError("invalid_request", "x").retryable).toBe(false);
    expect(new ContentAdapterError("forbidden", "x").retryable).toBe(false);
  });

  it("keeps the vendor error on cause, out of the message", () => {
    const vendor = new Error("PostgrestError: relation does not exist");
    const error = new ContentAdapterError("unavailable", "Content unavailable.", {
      cause: vendor,
    });

    expect(error.message).toBe("Content unavailable.");
    expect(error.cause).toBe(vendor);
  });

  it("is identifiable across the adapter boundary", () => {
    expect(isContentAdapterError(new ContentAdapterError("timeout", "x"))).toBe(true);
    expect(isContentAdapterError(new Error("plain"))).toBe(false);
    expect(isContentAdapterError(null)).toBe(false);
  });
});
