import { describe, expect, it } from "vitest";

import type { ActionDefinition, MutationActionDefinition, QueryActionDefinition } from "./types.js";

/**
 * These construct real definitions and narrow on `kind`. Their value is the
 * compile: if the discriminated union ever collapses into one loose shape,
 * `cache` on a mutation (or `confirm` on a query) would stop being a type
 * error and this file would need editing to keep passing.
 */

const feed: QueryActionDefinition = {
  id: "feed.releases",
  kind: "query",
  method: "GET",
  description: "Recent releases.",
  input: [{ name: "limit", label: "Limit", type: "number" }],
  allowedSources: ["static", "routeParam"],
  cache: { ttlMs: 60_000, swr: true },
};

const subscribe: MutationActionDefinition = {
  id: "newsletter.subscribe",
  kind: "mutation",
  method: "POST",
  description: "Add an address to the list.",
  input: [{ name: "email", label: "Email", type: "text", required: true }],
  allowedSources: ["static", "routeParam"],
  idempotent: true,
};

describe("ActionDefinition union", () => {
  it("narrows on kind", () => {
    const defs: ActionDefinition[] = [feed, subscribe];
    for (const def of defs) {
      if (def.kind === "query") {
        expect(["GET", "HEAD"]).toContain(def.method);
        expect(def.cache?.ttlMs ?? 0).toBeGreaterThanOrEqual(0);
      } else {
        expect(["POST", "PUT", "PATCH", "DELETE"]).toContain(def.method);
      }
    }
  });
});
