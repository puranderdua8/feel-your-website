import { describe, expect, it } from "vitest";

import { diffAgainstSnapshot } from "./check.js";
import { buildSnapshot } from "./snapshot.js";
import type { SnapshotSourceBundle } from "./snapshot.js";

const bundle = (overrides: Partial<SnapshotSourceBundle> = {}): SnapshotSourceBundle => ({
  id: "1",
  routeKey: "help",
  path: "/help",
  parentId: null,
  offline: false,
  paramNames: [],
  hasOutlet: false,
  ...overrides,
});

describe("diffAgainstSnapshot", () => {
  it("reports no drift when the published set matches the snapshot", () => {
    const snapshot = buildSnapshot([bundle()]);
    const drift = diffAgainstSnapshot([bundle()], snapshot);
    expect(drift).toEqual({ missingFromSnapshot: [], removedFromCms: [] });
  });

  it("flags a route published in the CMS but absent from the snapshot", () => {
    const snapshot = buildSnapshot([]);
    const drift = diffAgainstSnapshot(
      [bundle({ routeKey: "new-route", path: "/new-route" })],
      snapshot,
    );
    expect(drift.missingFromSnapshot).toEqual(["new-route"]);
    expect(drift.removedFromCms).toEqual([]);
  });

  it("flags a route in the snapshot that's no longer published", () => {
    const snapshot = buildSnapshot([bundle({ routeKey: "gone", path: "/gone" })]);
    const drift = diffAgainstSnapshot([], snapshot);
    expect(drift.removedFromCms).toEqual(["gone"]);
    expect(drift.missingFromSnapshot).toEqual([]);
  });
});
