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
  /** A parent/child pair for the hierarchy tests. */
  parentName: "Contract Parent",
  parentPath: "/contract-parent",
  childName: "Contract Child",
  childSegment: ":slug",
  childPath: "/contract-parent/:slug",
  param: { name: "slug", label: "Slug" },
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
  /**
   * Whether the backend enforces the route-hierarchy invariants (parent
   * pointer, cycle rejection, publish ordering, subtree delete). Defaults to
   * `true`. Set `false` for a backend whose migration has not yet landed them.
   */
  supportsHierarchy?: boolean;
}

export function runRouteCompositionWriterContract(
  options: RouteCompositionWriterContractOptions,
): void {
  const { name, createWriter } = options;
  const supportsHierarchy = options.supportsHierarchy ?? true;
  const f = ROUTE_COMPOSITION_FIXTURE;
  const hierarchyIt = supportsHierarchy ? it : it.skip;

  const heroTree = (): RouteSectionNode[] => [
    {
      instanceId: f.rootHero,
      sectionKey: "hero",
      content: { en: { title: "Hero" }, hi: { title: "हीरो" } },
      slots: {},
    },
  ];
  const cardTree = (): RouteSectionNode[] => [
    {
      instanceId: f.rootCard,
      sectionKey: "card",
      content: { en: { heading: "Card" } },
      slots: {
        icon: [
          {
            instanceId: f.slotIcon,
            sectionKey: "icon",
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
      expect(bundle.tree.map((node) => node.sectionKey)).toEqual(["hero"]);
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

      expect(flattenTree(bundle.tree)).toEqual(["card", "icon"]);
      expect(bundle.tree[0]?.slots.icon?.[0]?.sectionKey).toBe("icon");
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
      expect(flattenTree(updated.tree)).toEqual(["card", "icon"]);
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

    // --- Hierarchy: parent/child, parameters, publish ordering, subtree delete.

    const savePublishedParent = (writer: RouteCompositionWriter) =>
      writer.saveComposition(
        null,
        { name: f.parentName, path: f.parentPath, published: true, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );

    hierarchyIt("creates a child route under a parent, composing the absolute path", async () => {
      const writer = await createWriter();
      const parent = await savePublishedParent(writer);

      const child = await writer.saveComposition(
        null,
        {
          name: f.childName,
          path: f.childPath,
          pathSegment: f.childSegment,
          parentId: parent.id,
          params: [f.param],
          published: true,
          tree: heroTree(),
          seo: { en: { title: "{{slug}}" } },
        },
        null,
        "user-1",
      );

      expect(child.parentId).toBe(parent.id);
      expect(child.path).toBe(f.childPath);
      expect([...child.paramNames]).toEqual([f.param.name]);
      expect(child.paramMeta[f.param.name]?.label).toBe(f.param.label);
    });

    hierarchyIt("rejects a parent cycle", async () => {
      const writer = await createWriter();
      const a = await savePublishedParent(writer);
      const b = await writer.saveComposition(
        null,
        {
          name: f.childName,
          path: f.childPath,
          pathSegment: "child",
          parentId: a.id,
          published: true,
          tree: heroTree(),
          seo: {},
        },
        null,
        "user-1",
      );

      try {
        await writer.saveComposition(
          a.id,
          {
            name: f.parentName,
            path: f.parentPath,
            pathSegment: f.parentPath,
            parentId: b.id,
            published: true,
            tree: heroTree(),
            seo: {},
          },
          a.version,
          "user-1",
        );
        expect.unreachable("a parent cycle should have thrown");
      } catch (error) {
        expect(isRouteCompositionError(error) && error.code === "invalid").toBe(true);
      }
    });

    hierarchyIt("refuses to publish a child while its parent is a draft", async () => {
      const writer = await createWriter();
      const parent = await writer.saveComposition(
        null,
        { name: f.parentName, path: f.parentPath, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );

      try {
        await writer.saveComposition(
          null,
          {
            name: f.childName,
            path: f.childPath,
            pathSegment: f.childSegment,
            parentId: parent.id,
            params: [f.param],
            published: true,
            tree: heroTree(),
            seo: {},
          },
          null,
          "user-1",
        );
        expect.unreachable("a live child under a draft parent should have thrown");
      } catch (error) {
        expect(isRouteCompositionError(error) && error.code === "invalid").toBe(true);
      }
    });

    hierarchyIt("refuses to unpublish a parent that has a published child", async () => {
      const writer = await createWriter();
      const parent = await savePublishedParent(writer);
      await writer.saveComposition(
        null,
        {
          name: f.childName,
          path: f.childPath,
          pathSegment: f.childSegment,
          parentId: parent.id,
          params: [f.param],
          published: true,
          tree: heroTree(),
          seo: {},
        },
        null,
        "user-1",
      );

      try {
        await writer.saveComposition(
          parent.id,
          { name: f.parentName, path: f.parentPath, published: false, tree: heroTree(), seo: {} },
          parent.version,
          "user-1",
        );
        expect.unreachable("unpublishing a parent with a live child should have thrown");
      } catch (error) {
        expect(isRouteCompositionError(error) && error.code === "invalid").toBe(true);
      }
    });

    hierarchyIt("refuses a plain delete of a route that has children", async () => {
      const writer = await createWriter();
      const parent = await savePublishedParent(writer);
      await writer.saveComposition(
        null,
        {
          name: f.childName,
          path: f.childPath,
          pathSegment: f.childSegment,
          parentId: parent.id,
          params: [f.param],
          published: true,
          tree: heroTree(),
          seo: {},
        },
        null,
        "user-1",
      );

      try {
        await writer.deleteComposition(parent.id, parent.version, "user-1");
        expect.unreachable("deleting a parent with children should have thrown");
      } catch (error) {
        expect(isRouteCompositionError(error) && error.code === "invalid").toBe(true);
      }
    });

    hierarchyIt("deletes a whole subtree in one call", async () => {
      const writer = await createWriter();
      const parent = await savePublishedParent(writer);
      await writer.saveComposition(
        null,
        {
          name: f.childName,
          path: f.childPath,
          pathSegment: f.childSegment,
          parentId: parent.id,
          params: [f.param],
          published: true,
          tree: heroTree(),
          seo: {},
        },
        null,
        "user-1",
      );

      await writer.deleteSubtree(parent.id, parent.version, "user-1");

      // Gone: the parent path is free to recreate at version 1.
      const recreated = await writer.saveComposition(
        null,
        { name: f.parentName, path: f.parentPath, published: false, tree: heroTree(), seo: {} },
        null,
        "user-1",
      );
      expect(recreated.version).toBe(1);
    });
  });
}
