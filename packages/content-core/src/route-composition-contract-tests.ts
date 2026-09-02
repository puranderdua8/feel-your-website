import { describe, expect, it } from "vitest";

import { flattenTree } from "./compose.js";
import { isRouteCompositionError, RouteCompositionConflictError } from "./errors.js";
import type { RouteCompositionWriter } from "./route-composition-writer.js";
import type { RouteSectionNode } from "./types.js";

/**
 * The behavioural contract every {@link RouteCompositionWriter} must satisfy.
 *
 * Scoped to the one method — create, nested round-trip, in-place update,
 * version conflict, unknown id — mirroring `config-schema`'s
 * `runConfigBundleStoreContract` pattern but far smaller. Kept in its own
 * module (a separate build entry) so importing it never drags vitest into a
 * runtime bundle.
 *
 * ## Usage
 *
 * ```ts
 * import { runRouteCompositionWriterContract } from "@feel-your-website/content-core/route-composition-contract-tests";
 *
 * runRouteCompositionWriterContract({
 *   name: "MemoryContentAdapter",
 *   createWriter: () => new MemoryContentAdapter({ content: {}, routes: [] }),
 * });
 * ```
 */
export const ROUTE_COMPOSITION_FIXTURE = {
  name: "Contract Route",
  path: "/contract-composed",
  /** Client-minted instance ids — real uuids, since a Postgres backend casts them. */
  rootCard: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  slotIcon: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  rootHero: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  unknownId: "00000000-0000-4000-8000-000000000000",
} as const;

export interface RouteCompositionWriterContractOptions {
  /** Shown in test names, so a failure says which implementation broke. */
  name: string;
  /** A fresh, empty writer per call, so test ordering cannot matter. */
  createWriter: () => Promise<RouteCompositionWriter> | RouteCompositionWriter;
}

export function runRouteCompositionWriterContract(
  options: RouteCompositionWriterContractOptions,
): void {
  const { name, createWriter } = options;
  const f = ROUTE_COMPOSITION_FIXTURE;

  const heroTree = (): RouteSectionNode[] => [
    {
      instanceId: f.rootHero,
      ref: { key: "hero", variant: "" },
      content: { en: { title: "Hero" }, hi: { title: "हीरो" } },
      slots: {},
    },
  ];
  const cardTree = (): RouteSectionNode[] => [
    {
      instanceId: f.rootCard,
      ref: { key: "card", variant: "" },
      content: { en: { heading: "Card" } },
      slots: {
        icon: [
          {
            instanceId: f.slotIcon,
            ref: { key: "icon", variant: "star" },
            content: { en: { name: "star" } },
            slots: {},
          },
        ],
      },
    },
  ];

  describe(`RouteCompositionWriter contract: ${name}`, () => {
    it("creates a bundle at version 1 with the given tree", async () => {
      const writer = await createWriter();

      const bundle = await writer.saveComposition(
        null,
        { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );

      expect(bundle.version).toBe(1);
      expect(bundle.path).toBe(f.path);
      expect(bundle.tree.map((node) => node.ref.key)).toEqual(["hero"]);
    });

    it("round-trips a nested slot tree", async () => {
      const writer = await createWriter();

      const bundle = await writer.saveComposition(
        null,
        {
          name: f.name,
          path: f.path,
          published: true,
          tree: cardTree(),
          seo: { en: { title: "Card page", keywords: ["a", "b"] } },
        },
        null,
        "user-1",
      );

      expect(flattenTree(bundle.tree).map((ref) => ref.key)).toEqual(["card", "icon"]);
      expect(bundle.tree[0]?.slots.icon?.[0]?.ref).toEqual({ key: "icon", variant: "star" });
      // The saved bundle echoes what it was given — per-instance content at the
      // root and inside a slot, and the per-locale SEO. (A full storage
      // round-trip through `getComposition` is exercised by each backend's own
      // read tests.)
      expect(bundle.tree[0]?.content).toEqual({ en: { heading: "Card" } });
      expect(bundle.tree[0]?.slots.icon?.[0]?.content).toEqual({ en: { name: "star" } });
      expect(bundle.seo).toEqual({ en: { title: "Card page", keywords: ["a", "b"] } });
    });

    it("updates in place, incrementing the version", async () => {
      const writer = await createWriter();
      const created = await writer.saveComposition(
        null,
        { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );

      const updated = await writer.saveComposition(
        created.id,
        { name: f.name, path: f.path, published: true, tree: cardTree(), seo: {} },
        created.version,
        "user-1",
      );

      expect(updated.version).toBe(created.version + 1);
      expect(flattenTree(updated.tree).map((ref) => ref.key)).toEqual(["card", "icon"]);
    });

    it("rejects a write against a stale version", async () => {
      const writer = await createWriter();
      const created = await writer.saveComposition(
        null,
        { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );
      await writer.saveComposition(
        created.id,
        { name: f.name, path: f.path, published: false, tree: cardTree(), seo: {} },
        created.version,
        "user-1",
      );

      try {
        await writer.saveComposition(
          created.id,
          { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
          created.version,
          "user-1",
        );
        expect.unreachable("a stale write should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RouteCompositionConflictError);
        const conflict = error as RouteCompositionConflictError;
        expect(conflict.expectedVersion).toBe(created.version);
        expect(conflict.actualVersion).toBe(created.version + 1);
      }
    });

    it("reports not_found for an unknown bundle id", async () => {
      const writer = await createWriter();

      try {
        await writer.saveComposition(
          f.unknownId,
          { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
          1,
          "user-1",
        );
        expect.unreachable("an unknown id should have thrown");
      } catch (error) {
        expect(isRouteCompositionError(error) && error.code === "not_found").toBe(true);
      }
    });

    it("deletes a composition, version-checked", async () => {
      const writer = await createWriter();
      const created = await writer.saveComposition(
        null,
        { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );

      // Stale version is refused.
      try {
        await writer.deleteComposition(created.id, created.version + 99, "user-1");
        expect.unreachable("a stale delete should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(RouteCompositionConflictError);
      }

      await writer.deleteComposition(created.id, created.version, "user-1");

      // Gone: recreating at the same path now succeeds at version 1.
      const recreated = await writer.saveComposition(
        null,
        { name: f.name, path: f.path, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );
      expect(recreated.version).toBe(1);
    });

    it("reports not_found when deleting an unknown bundle id", async () => {
      const writer = await createWriter();
      try {
        await writer.deleteComposition(f.unknownId, 1, "user-1");
        expect.unreachable("an unknown id should have thrown");
      } catch (error) {
        expect(isRouteCompositionError(error) && error.code === "not_found").toBe(true);
      }
    });
  });
}
