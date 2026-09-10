import { describe, expect, it } from "vitest";

import { actionCatalog } from "./actions.js";

describe("actionCatalog", () => {
  it("builds without a definition error", () => {
    expect(actionCatalog.values.length).toBeGreaterThan(0);
  });

  it("exposes the seed actions with the expected kinds", () => {
    expect(actionCatalog.byId.get("feed.releases")?.kind).toBe("query");
    expect(actionCatalog.byId.get("newsletter.subscribe")?.kind).toBe("mutation");
    expect(actionCatalog.byId.get("webhook.trigger")?.kind).toBe("mutation");
  });

  it("only caches the query", () => {
    const query = actionCatalog.byId.get("feed.releases");
    expect(query?.kind === "query" && query.cache?.ttlMs).toBe(60_000);
  });

  it("lets newsletter.subscribe take a form-input value", () => {
    expect(actionCatalog.byId.get("newsletter.subscribe")?.allowedSources).toContain("formInput");
  });

  it("has unique ids", () => {
    expect(new Set(actionCatalog.values).size).toBe(actionCatalog.values.length);
  });
});
