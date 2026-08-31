import { describe, expect, it } from "vitest";

import { ConfigConflictError, InvalidItemsError, isConfigStoreError } from "./errors.js";
import type { ConfigBundleStore } from "./types.js";

/**
 * The behavioural contract every ConfigBundleStore must satisfy.
 *
 * The substrate is only worth sharing if every implementation of it behaves
 * identically — otherwise "roles and routes use the same plumbing" is a claim
 * about file layout rather than about behaviour.
 */
export interface ConfigBundleStoreContractOptions {
  name: string;
  /** A fresh, empty store validating against {@link CONFIG_CONTRACT_FIXTURE}. */
  createStore: () => Promise<ConfigBundleStore> | ConfigBundleStore;
}

export const CONFIG_CONTRACT_FIXTURE = {
  /** Valid, assignable vocabulary. */
  validItems: ["alpha", "beta", "gamma"],
  /** Not in the vocabulary at all. */
  unknownItem: "not-a-real-item",
  /** Valid vocabulary that must never be assignable through the store. */
  forbiddenItem: "forbidden",
  actor: "user-1",
  otherActor: "user-2",
} as const;

export function runConfigBundleStoreContract(options: ConfigBundleStoreContractOptions): void {
  const { name, createStore } = options;
  const f = CONFIG_CONTRACT_FIXTURE;

  describe(`ConfigBundleStore contract: ${name}`, () => {
    describe("create", () => {
      it("starts at version 1 and records the actor", async () => {
        const store = await createStore();
        const bundle = await store.create({ name: "Content Manager", items: ["alpha"] }, f.actor);

        expect(bundle.version).toBe(1);
        expect(bundle.updatedBy).toBe(f.actor);
        expect(Date.parse(bundle.updatedAt)).not.toBeNaN();
      });

      it("rejects items outside the vocabulary", async () => {
        const store = await createStore();

        try {
          await store.create({ name: "Bad", items: [f.unknownItem] }, f.actor);
          expect.unreachable("should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(InvalidItemsError);
          expect((error as InvalidItemsError).unknownItems).toContain(f.unknownItem);
        }
      });

      it("reports every bad item at once, not just the first", async () => {
        // An editor should see all problems in one pass rather than
        // discovering them one failed save at a time.
        const store = await createStore();

        try {
          await store.create({ name: "Bad", items: [f.unknownItem, f.forbiddenItem] }, f.actor);
          expect.unreachable("should have thrown");
        } catch (error) {
          expect((error as InvalidItemsError).unknownItems.length).toBe(2);
        }
      });

      it("refuses seed-only items even though they are valid vocabulary", async () => {
        // This is the privilege-escalation guard: `manage:roles` exists, but
        // must never be grantable through the editor.
        const store = await createStore();

        await expect(
          store.create({ name: "Escalate", items: [f.forbiddenItem] }, f.actor),
        ).rejects.toBeInstanceOf(InvalidItemsError);
      });
    });

    describe("get / list", () => {
      it("returns null for an unknown id rather than throwing", async () => {
        const store = await createStore();
        await expect(store.get("nope")).resolves.toBeNull();
      });

      it("lists what was created", async () => {
        const store = await createStore();
        await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.create({ name: "Two", items: ["beta"] }, f.actor);

        expect((await store.list()).length).toBe(2);
      });

      it("returns an empty list, not null, when there is nothing", async () => {
        const store = await createStore();
        await expect(store.list()).resolves.toEqual([]);
      });
    });

    describe("update", () => {
      it("increments the version and records the new actor", async () => {
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);

        const updated = await store.update(
          created.id,
          { items: ["alpha", "beta"] },
          created.version,
          f.otherActor,
        );

        expect(updated.version).toBe(2);
        expect(updated.updatedBy).toBe(f.otherActor);
        expect([...updated.items]).toEqual(["alpha", "beta"]);
      });

      it("rejects a write based on a stale read", async () => {
        // Two editors in a CMS is the normal case. Last-write-wins would
        // silently discard the other person's change.
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.update(created.id, { items: ["beta"] }, 1, f.actor);

        try {
          await store.update(created.id, { items: ["gamma"] }, 1, f.otherActor);
          expect.unreachable("should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigConflictError);
          const conflict = error as ConfigConflictError;
          // Both versions are carried so the UI can explain what happened.
          expect(conflict.expectedVersion).toBe(1);
          expect(conflict.actualVersion).toBe(2);
        }
      });

      it("leaves the bundle untouched when a conflicting write is rejected", async () => {
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.update(created.id, { items: ["beta"] }, 1, f.actor);
        await store
          .update(created.id, { items: ["gamma"] }, 1, f.otherActor)
          .catch(() => undefined);

        const current = await store.get(created.id);
        expect([...(current?.items ?? [])]).toEqual(["beta"]);
        expect(current?.version).toBe(2);
      });

      it("validates items on update, not only on create", async () => {
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);

        await expect(
          store.update(created.id, { items: [f.unknownItem] }, 1, f.actor),
        ).rejects.toBeInstanceOf(InvalidItemsError);
      });

      it("reports not_found for an unknown id", async () => {
        const store = await createStore();

        await expect(store.update("nope", { name: "x" }, 1, f.actor)).rejects.toSatisfy(
          (error: unknown) => isConfigStoreError(error) && error.code === "not_found",
        );
      });
    });

    describe("history", () => {
      it("records every change, newest first", async () => {
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.update(created.id, { items: ["beta"] }, 1, f.otherActor);

        const history = await store.history(created.id);

        expect(history.map((entry) => entry.version)).toEqual([2, 1]);
        expect(history[0]?.action).toBe("updated");
        expect(history[1]?.action).toBe("created");
        expect(history[0]?.updatedBy).toBe(f.otherActor);
      });

      it("captures the items as they were at each version", async () => {
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.update(created.id, { items: ["beta"] }, 1, f.actor);

        const history = await store.history(created.id);
        expect([...(history[1]?.items ?? [])]).toEqual(["alpha"]);
      });

      it("retains history after deletion", async () => {
        // An audit trail that forgets deletions cannot answer "who removed
        // this permission from that role?" — the question most likely to be
        // asked after an incident.
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.delete(created.id, 1, f.otherActor);

        const history = await store.history(created.id);
        expect(history[0]?.action).toBe("deleted");
        expect(history[0]?.updatedBy).toBe(f.otherActor);
        await expect(store.get(created.id)).resolves.toBeNull();
      });

      it("returns an empty history for an unknown id", async () => {
        const store = await createStore();
        await expect(store.history("nope")).resolves.toEqual([]);
      });
    });

    describe("delete", () => {
      it("rejects a delete based on a stale read", async () => {
        const store = await createStore();
        const created = await store.create({ name: "One", items: ["alpha"] }, f.actor);
        await store.update(created.id, { items: ["beta"] }, 1, f.actor);

        await expect(store.delete(created.id, 1, f.otherActor)).rejects.toBeInstanceOf(
          ConfigConflictError,
        );
        await expect(store.get(created.id)).resolves.not.toBeNull();
      });
    });
  });
}
