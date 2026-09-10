import {
  defineActions,
  MemoryActionInvoker,
  type ActionInvoker,
} from "@feel-your-website/action-core";
import { actionCatalog } from "@feel-your-website/action-registry";
import type { RouteBundle, RouteSectionNode } from "@feel-your-website/content-core";
import { describe, expect, it } from "vitest";

import { resolveAndInvokeAction, type InvokeActionDeps } from "./invoke-action.js";

const bundle = (over: Partial<RouteBundle> & Pick<RouteBundle, "id" | "path">): RouteBundle => ({
  pathSegment: over.path,
  parentId: null,
  paramNames: [],
  paramMeta: {},
  tree: [],
  seo: {},
  version: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const actionButton = (over: Partial<Record<string, unknown>> = {}): RouteSectionNode =>
  ({
    instanceId: "cta",
    sectionKey: "button",
    content: {
      en: {
        label: "Subscribe",
        mode: "action",
        actionId: "newsletter.subscribe",
        body: JSON.stringify({ email: { source: "routeParam", value: "slug" } }),
        ...over,
      },
    },
    slots: {},
  }) as RouteSectionNode;

const routeWith = (node: RouteSectionNode): RouteBundle[] => [
  bundle({
    id: "n",
    path: "/n/:slug",
    pathSegment: "/n/:slug",
    paramNames: ["slug"],
    tree: [node],
  }),
];

const deps = (over: Partial<InvokeActionDeps>): InvokeActionDeps => ({
  manifest: routeWith(actionButton()),
  locale: "en",
  session: { userId: "u1", permissions: new Set() },
  invoker: new MemoryActionInvoker({ echoUnseeded: true }),
  ...over,
});

const input = (over: Partial<Parameters<typeof resolveAndInvokeAction>[0]> = {}) => ({
  path: "/n/hello",
  instanceId: "cta",
  requestId: "req-1",
  ...over,
});

describe("resolveAndInvokeAction", () => {
  it("re-resolves the route, rebuilds the body from params, and invokes", async () => {
    const result = await resolveAndInvokeAction(input(), deps({}));
    // echoUnseeded invoker returns the body it was handed.
    expect(result).toEqual({ ok: true, data: { email: "hello" } });
  });

  it("returns not_found for an unmatched path", async () => {
    const result = await resolveAndInvokeAction(input({ path: "/nope" }), deps({}));
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("returns not_found when the instance id names no button node", async () => {
    const result = await resolveAndInvokeAction(input({ instanceId: "ghost" }), deps({}));
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("returns not_found when the node is a link, not an action", async () => {
    const manifest = routeWith(actionButton({ mode: "link", href: "/x" }));
    const result = await resolveAndInvokeAction(input(), deps({ manifest }));
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("returns not_found when the action id names a query, not a mutation", async () => {
    const manifest = routeWith(actionButton({ actionId: "feed.releases" }));
    const result = await resolveAndInvokeAction(input(), deps({ manifest }));
    expect(result).toEqual({ ok: false, code: "not_found" });
  });

  it("returns invalid_request when the body mapping is malformed", async () => {
    const manifest = routeWith(actionButton({ body: "{ not json" }));
    const result = await resolveAndInvokeAction(input(), deps({ manifest }));
    expect(result).toEqual({ ok: false, code: "invalid_request" });
  });

  it("returns invalid_request with issues when a required input is unmapped", async () => {
    const manifest = routeWith(actionButton({ body: "{}" }));
    const result = await resolveAndInvokeAction(input(), deps({ manifest }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_request");
      expect(result.issues?.[0]?.field).toBe("email");
    }
  });

  describe("RBAC", () => {
    const gated = defineActions([
      {
        id: "gated.mutate",
        kind: "mutation",
        method: "POST",
        description: "needs a permission",
        input: [],
        allowedSources: [],
        requiredPermission: "manage:things",
      },
    ]);
    const manifest = routeWith(actionButton({ actionId: "gated.mutate", body: "{}" }));

    it("forbids a caller without the required permission", async () => {
      const result = await resolveAndInvokeAction(
        input(),
        deps({ manifest, catalog: gated, session: { userId: "u1", permissions: new Set() } }),
      );
      expect(result).toEqual({ ok: false, code: "forbidden" });
    });

    it("allows a caller who holds it", async () => {
      const result = await resolveAndInvokeAction(
        input(),
        deps({
          manifest,
          catalog: gated,
          session: { userId: "u1", permissions: new Set(["manage:things"]) },
        }),
      );
      expect(result).toEqual({ ok: true, data: {} });
    });
  });

  describe("idempotency", () => {
    function countingInvoker(): { invoker: ActionInvoker; calls: () => number } {
      let calls = 0;
      return {
        calls: () => calls,
        invoker: {
          invoke: (_id, body) => {
            calls += 1;
            return Promise.resolve({ ok: true, data: { ...body, n: calls } });
          },
        },
      };
    }

    it("replays the first result for a repeated requestId (newsletter.subscribe is idempotent)", async () => {
      const { invoker, calls } = countingInvoker();
      const replayCache = new Map();
      const d = deps({ invoker, replayCache });

      const a = await resolveAndInvokeAction(input({ requestId: "same" }), d);
      const b = await resolveAndInvokeAction(input({ requestId: "same" }), d);
      expect(calls()).toBe(1);
      expect(a).toEqual(b);

      await resolveAndInvokeAction(input({ requestId: "other" }), d);
      expect(calls()).toBe(2);
    });

    it("does not retain a failed attempt — a repeat retries", async () => {
      const replayCache = new Map();
      const d = deps({
        invoker: new MemoryActionInvoker({ failWith: "unavailable" }),
        replayCache,
      });

      const first = await resolveAndInvokeAction(input({ requestId: "same" }), d);
      expect(first).toEqual({ ok: false, code: "unavailable" });
      expect(replayCache.size).toBe(0);
    });
  });

  it("maps a parseResult that rejects the payload to invalid_response", async () => {
    const strict = defineActions([
      {
        id: "strict.mutate",
        kind: "mutation",
        method: "POST",
        description: "rejects everything",
        input: [],
        allowedSources: [],
        parseResult: () => null,
      },
    ]);
    const manifest = routeWith(actionButton({ actionId: "strict.mutate", body: "{}" }));
    const result = await resolveAndInvokeAction(input(), deps({ manifest, catalog: strict }));
    expect(result).toEqual({ ok: false, code: "invalid_response" });
  });

  it("uses the real catalog by default (newsletter.subscribe is a known mutation)", async () => {
    expect(actionCatalog.byId.get("newsletter.subscribe")?.kind).toBe("mutation");
    const result = await resolveAndInvokeAction(input(), {
      manifest: routeWith(actionButton()),
      locale: "en",
      session: { userId: "u1", permissions: new Set() },
      invoker: new MemoryActionInvoker({ echoUnseeded: true }),
    });
    expect(result).toEqual({ ok: true, data: { email: "hello" } });
  });
});
