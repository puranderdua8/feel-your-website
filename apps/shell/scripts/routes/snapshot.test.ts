import { describe, expect, it } from "vitest";

import {
  buildSnapshot,
  hashSnapshot,
  parseSnapshot,
  serializeSnapshot,
  SnapshotParseError,
  type SnapshotSourceBundle,
} from "./snapshot.js";

const bundle = (overrides: Partial<SnapshotSourceBundle> = {}): SnapshotSourceBundle => ({
  id: "id-1",
  routeKey: "help",
  path: "/help",
  parentId: null,
  offline: false,
  paramNames: [],
  hasOutlet: false,
  ...overrides,
});

describe("buildSnapshot", () => {
  it("resolves parentId to the parent's routeKey and drops the UUID", () => {
    const snapshot = buildSnapshot([
      bundle({ id: "uuid-blog", routeKey: "blog", path: "/blog", hasOutlet: true }),
      bundle({
        id: "uuid-slug",
        routeKey: "blog-slug",
        path: "/blog/:slug",
        parentId: "uuid-blog",
        paramNames: ["slug"],
      }),
    ]);

    const child = snapshot.routes.find((r) => r.routeKey === "blog-slug")!;
    expect(child.parentKey).toBe("blog");
    expect(JSON.stringify(snapshot)).not.toContain("uuid-blog");
  });

  it("sorts routes by routeKey", () => {
    const snapshot = buildSnapshot([
      bundle({ id: "1", routeKey: "zeta", path: "/zeta" }),
      bundle({ id: "2", routeKey: "alpha", path: "/alpha" }),
    ]);
    expect(snapshot.routes.map((r) => r.routeKey)).toEqual(["alpha", "zeta"]);
  });

  it("produces no parentKey for a top-level route", () => {
    const snapshot = buildSnapshot([bundle()]);
    expect(snapshot.routes[0]!.parentKey).toBeNull();
  });
});

describe("serializeSnapshot / parseSnapshot", () => {
  it("round-trips", () => {
    const snapshot = buildSnapshot([
      bundle({ routeKey: "blog", path: "/blog", hasOutlet: true }),
      bundle({ id: "2", routeKey: "help", path: "/help" }),
    ]);
    const parsed = parseSnapshot(serializeSnapshot(snapshot));
    expect(parsed).toEqual(snapshot);
  });

  it("is deterministic regardless of input order", () => {
    const a = buildSnapshot([
      bundle({ routeKey: "b", path: "/b" }),
      bundle({ id: "2", routeKey: "a", path: "/a" }),
    ]);
    const b = buildSnapshot([
      bundle({ id: "2", routeKey: "a", path: "/a" }),
      bundle({ routeKey: "b", path: "/b" }),
    ]);
    expect(serializeSnapshot(a)).toBe(serializeSnapshot(b));
  });

  it("rejects invalid JSON", () => {
    expect(() => parseSnapshot("not json")).toThrow(SnapshotParseError);
  });

  it("rejects an unsupported version", () => {
    expect(() => parseSnapshot(JSON.stringify({ version: 2, routes: [] }))).toThrow(
      SnapshotParseError,
    );
  });

  it("rejects a route missing a required field", () => {
    expect(() =>
      parseSnapshot(JSON.stringify({ version: 1, routes: [{ routeKey: "help" }] })),
    ).toThrow(SnapshotParseError);
  });

  it("rejects a path that doesn't start with '/'", () => {
    expect(() =>
      parseSnapshot(
        JSON.stringify({
          version: 1,
          routes: [
            {
              routeKey: "help",
              path: "help",
              parentKey: null,
              hasOutlet: false,
              offline: false,
              paramNames: [],
            },
          ],
        }),
      ),
    ).toThrow(SnapshotParseError);
  });
});

describe("hashSnapshot", () => {
  it("is stable for the same route set regardless of input order", () => {
    const a = buildSnapshot([
      bundle({ routeKey: "b", path: "/b" }),
      bundle({ id: "2", routeKey: "a", path: "/a" }),
    ]);
    const b = buildSnapshot([
      bundle({ id: "2", routeKey: "a", path: "/a" }),
      bundle({ routeKey: "b", path: "/b" }),
    ]);
    expect(hashSnapshot(a)).toBe(hashSnapshot(b));
  });

  it("changes when the route set changes", () => {
    const a = buildSnapshot([bundle({ routeKey: "help", path: "/help" })]);
    const b = buildSnapshot([bundle({ routeKey: "help", path: "/help", offline: true })]);
    expect(hashSnapshot(a)).not.toBe(hashSnapshot(b));
  });
});
