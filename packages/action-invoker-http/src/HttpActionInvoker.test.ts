import { defineActions } from "@feel-your-website/action-core";
import {
  runActionInvokerContract,
  ACTION_CONTRACT_FIXTURE,
} from "@feel-your-website/action-core/contract-tests";
import { describe, expect, it, vi } from "vitest";

import { HttpActionInvoker } from "./HttpActionInvoker.js";
import type { HttpActionBindings } from "./bindings.js";

const catalog = defineActions([
  {
    id: "feed.releases",
    kind: "query",
    method: "GET",
    description: "Releases.",
    input: [{ name: "limit", label: "Limit", type: "number" }],
    allowedSources: ["static"],
  },
  {
    id: "newsletter.subscribe",
    kind: "mutation",
    method: "POST",
    description: "Subscribe.",
    input: [{ name: "email", label: "Email", type: "text", required: true }],
    allowedSources: ["static"],
    idempotent: true,
  },
  {
    id: "item.get",
    kind: "query",
    method: "GET",
    description: "One item.",
    input: [{ name: "id", label: "Id", type: "text" }],
    allowedSources: ["routeParam"],
  },
]);

const bindings: HttpActionBindings = {
  "feed.releases": {
    urlTemplate: "https://api.example.com/releases",
    method: "GET",
    allowedParams: ["limit"],
    allowedHost: "api.example.com",
  },
  "newsletter.subscribe": {
    urlTemplate: "https://api.example.com/subscribe",
    method: "POST",
    allowedParams: ["email"],
    idempotencyHeader: "Idempotency-Key",
    allowedHost: "api.example.com",
  },
  "item.get": {
    urlTemplate: "https://api.example.com/items/:id",
    method: "GET",
    allowedParams: ["id"],
    allowedHost: "api.example.com",
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function make(fetchImpl: typeof fetch) {
  return new HttpActionInvoker({
    catalog,
    bindings,
    hostAllowlist: ["api.example.com"],
    fetchImpl,
  });
}

describe("HttpActionInvoker", () => {
  it("puts a query's allowed params on the query string", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://api.example.com/releases?limit=5");
      return jsonResponse([{ title: "x" }]);
    }) as unknown as typeof fetch;

    const result = await make(fetchImpl).invoke("feed.releases", { limit: 5 }, {});
    expect(result).toEqual({ ok: true, data: [{ title: "x" }] });
  });

  it("fills a path placeholder and drops disallowed params", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://api.example.com/items/abc");
      return jsonResponse({ id: "abc" });
    }) as unknown as typeof fetch;

    await make(fetchImpl).invoke("item.get", { id: "abc", secret: "leak" }, {});
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("sends a mutation body as JSON and forwards the idempotency key", async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      seen = init;
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    await make(fetchImpl).invoke(
      "newsletter.subscribe",
      { email: "a@b.c" },
      { requestId: "req-1" },
    );

    expect(seen?.method).toBe("POST");
    expect(JSON.parse(String(seen?.body))).toEqual({ email: "a@b.c" });
    expect((seen?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((seen?.headers as Record<string, string>)["Idempotency-Key"]).toBe("req-1");
  });

  it("maps upstream statuses to codes without leaking the body", async () => {
    for (const [status, code] of [
      [404, "not_found"],
      [429, "rate_limited"],
      [400, "invalid_request"],
      [503, "unavailable"],
    ] as const) {
      const fetchImpl = (async () =>
        new Response("upstream said something secret", { status })) as unknown as typeof fetch;
      const result = await make(fetchImpl).invoke("feed.releases", { limit: 1 }, {});
      expect(result).toEqual({ ok: false, code });
    }
  });

  it("rejects a non-JSON response as invalid_response", async () => {
    const fetchImpl = (async () =>
      new Response("<html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;
    const result = await make(fetchImpl).invoke("feed.releases", { limit: 1 }, {});
    expect(result).toEqual({ ok: false, code: "invalid_response" });
  });

  it("reports a thrown fetch as unavailable", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await make(fetchImpl).invoke("feed.releases", { limit: 1 }, {});
    expect(result).toEqual({ ok: false, code: "unavailable" });
  });

  it("reports a timed-out call as timeout", async () => {
    const fetchImpl = ((_url: string | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      })) as unknown as typeof fetch;

    const invoker = new HttpActionInvoker({
      catalog,
      bindings: {
        ...bindings,
        "feed.releases": { ...bindings["feed.releases"]!, timeoutMs: 5 },
      },
      hostAllowlist: ["api.example.com"],
      fetchImpl,
    });

    const result = await invoker.invoke("feed.releases", { limit: 1 }, {});
    expect(result).toEqual({ ok: false, code: "timeout" });
  });
});

const contractCatalog = defineActions([
  {
    id: ACTION_CONTRACT_FIXTURE.knownId,
    kind: "query",
    method: "GET",
    description: "Contract fixture.",
    input: [],
    allowedSources: ["static"],
  },
]);

const contractBindings: HttpActionBindings = {
  [ACTION_CONTRACT_FIXTURE.knownId]: {
    urlTemplate: "https://api.example.com/contract",
    method: "GET",
    allowedParams: [],
    allowedHost: "api.example.com",
  },
};

runActionInvokerContract({
  name: "HttpActionInvoker (stubbed fetch)",
  createInvoker: () =>
    new HttpActionInvoker({
      catalog: contractCatalog,
      bindings: contractBindings,
      hostAllowlist: ["api.example.com"],
      fetchImpl: (async () => jsonResponse({ hello: "world" })) as unknown as typeof fetch,
    }),
  createUnavailableInvoker: () =>
    new HttpActionInvoker({
      catalog: contractCatalog,
      bindings: contractBindings,
      hostAllowlist: ["api.example.com"],
      fetchImpl: (async () => new Response("", { status: 503 })) as unknown as typeof fetch,
    }),
});
