import { describe, expect, it } from "vitest";

import type { ContentAdapter } from "./adapter.js";
import { CONTRACT_FIXTURE } from "./contract-fixture.js";
import { ContentAdapterError } from "./errors.js";
import { parseRoutePattern } from "./route-match.js";
import type { RouteSectionNode } from "./types.js";

/**
 * The behavioural contract every ContentAdapter must satisfy.
 *
 * Matching method signatures is not sufficient for substitutability at the
 * points that actually matter. TypeScript will happily accept an adapter that
 * returns a draft route from `getRouteManifest` while another hides it, or
 * that returns `null` messages where another returns `{}` — and every call
 * site then has to know which one it is talking to. That is the seam leaking.
 *
 * So the contract is executable, and shared: `content-adapter-memory` and
 * `content-adapter-supabase` run this identical suite. A future
 * `content-adapter-strapi` is finished when it passes, which is a far more
 * useful definition of "done" than "it compiles".
 *
 * Written before any real backend exists, deliberately — a contract derived
 * from an implementation just describes that implementation.
 *
 * ## Usage
 *
 * ```ts
 * import { runContentAdapterContract } from "@feel-your-website/content-core/contract-tests";
 *
 * runContentAdapterContract({
 *   name: "MemoryContentAdapter",
 *   createAdapter: async () => new MemoryContentAdapter(fixtures),
 * });
 * ```
 */
export interface ContentAdapterContractOptions {
  /** Shown in test names, so a failure says which adapter broke. */
  name: string;
  /**
   * Builds an adapter seeded with at least one published route and some
   * UI-chrome messages. Returns a fresh instance per test so ordering cannot
   * matter.
   */
  createAdapter: () => Promise<ContentAdapter> | ContentAdapter;
  /**
   * Builds an adapter whose backend is unreachable, if the implementation can
   * simulate one. Omit to skip the failure-shape tests — but note that
   * skipping them leaves the error contract unverified for this adapter.
   */
  createUnavailableAdapter?: () => Promise<ContentAdapter> | ContentAdapter;
  /**
   * Whether the seeded backend carries route hierarchy — a parent/child pair
   * and a parameterised route. Defaults to `true`. Set `false` for a backend
   * whose migration has not yet landed the `parent_bundle_id` / `param_meta`
   * columns, to skip the hierarchy assertions (they resume once it has).
   */
  supportsHierarchy?: boolean;
}

// Re-exported so a suite can import fixture and runner from one place.
export { CONTRACT_FIXTURE };

export function runContentAdapterContract(options: ContentAdapterContractOptions): void {
  const { name, createAdapter, createUnavailableAdapter } = options;
  const supportsHierarchy = options.supportsHierarchy ?? true;
  const f = CONTRACT_FIXTURE;

  describe(`ContentAdapter contract: ${name}`, () => {
    describe("getRouteManifest", () => {
      it("returns only published bundles", async () => {
        const adapter = await createAdapter();
        const manifest = await adapter.getRouteManifest(f.defaultLocale);

        expect(Array.isArray(manifest)).toBe(true);
        for (const bundle of manifest) {
          expect(bundle.path.startsWith("/")).toBe(true);
          expect(bundle.version).toBeGreaterThan(0);
          // SEO is a plain `locale -> RouteSeo` object, never null.
          expect(bundle.seo).toBeTypeOf("object");
          expect(bundle.seo).not.toBeNull();

          // Every bundle carries its hierarchy + parameter fields.
          expect(typeof bundle.pathSegment).toBe("string");
          expect(bundle.pathSegment.length).toBeGreaterThan(0);
          expect(bundle.parentId === null || typeof bundle.parentId === "string").toBe(true);
          expect(Array.isArray(bundle.paramNames)).toBe(true);
          expect(bundle.paramMeta).toBeTypeOf("object");
          expect(bundle.paramMeta).not.toBeNull();
          if (bundle.paramNames.length > 0) {
            expect(bundle.path).toContain(":");
            expect([...parseRoutePattern(bundle.path).paramNames]).toEqual([...bundle.paramNames]);
          }
        }
      });

      (supportsHierarchy ? it : it.skip)(
        "exposes a resolvable parent/child hierarchy and a parameterised route",
        async () => {
          const adapter = await createAdapter();
          const manifest = await adapter.getRouteManifest(f.defaultLocale);
          const ids = new Set(manifest.map((bundle) => bundle.id));

          const child = manifest.find((bundle) => bundle.parentId !== null);
          expect(child, "the seed should include a nested route").toBeDefined();
          expect(ids.has(child!.parentId!)).toBe(true);

          const parameterised = manifest.find((bundle) => bundle.paramNames.length > 0);
          expect(parameterised, "the seed should include a parameterised route").toBeDefined();
        },
      );

      it("returns an array, never null, when there are no routes", async () => {
        const adapter = await createAdapter();
        const manifest = await adapter.getRouteManifest("zz");

        expect(Array.isArray(manifest)).toBe(true);
      });

      it("exposes a section-instance tree whose nodes are well-formed", async () => {
        const adapter = await createAdapter();
        const manifest = await adapter.getRouteManifest(f.defaultLocale);

        const assertNode = (node: RouteSectionNode): void => {
          expect(typeof node.instanceId).toBe("string");
          expect(node.instanceId.length).toBeGreaterThan(0);
          expect(typeof node.sectionKey).toBe("string");
          expect(node.sectionKey.length).toBeGreaterThan(0);
          // Content is a plain `locale -> field bag` object, never null.
          expect(node.content).toBeTypeOf("object");
          expect(node.content).not.toBeNull();
          for (const fields of Object.values(node.content)) {
            expect(fields).toBeTypeOf("object");
          }
          for (const children of Object.values(node.slots)) {
            for (const child of children) assertNode(child);
          }
        };

        for (const bundle of manifest) {
          expect(Array.isArray(bundle.tree)).toBe(true);
          for (const node of bundle.tree) assertNode(node);
        }
      });
    });

    describe("getRouteHeaders", () => {
      it("returns a lightweight, well-formed header per published route", async () => {
        const adapter = await createAdapter();
        const [headers, manifest] = await Promise.all([
          adapter.getRouteHeaders(),
          adapter.getRouteManifest(f.defaultLocale),
        ]);

        expect(Array.isArray(headers)).toBe(true);
        // Same set of published routes as the manifest, by id.
        expect(new Set(headers.map((h) => h.id))).toEqual(new Set(manifest.map((b) => b.id)));

        for (const header of headers) {
          expect(header.path.startsWith("/")).toBe(true);
          expect(typeof header.pathSegment).toBe("string");
          expect(header.parentId === null || typeof header.parentId === "string").toBe(true);
          expect(typeof header.hasParams).toBe("boolean");
          expect(header.hasParams).toBe(header.path.includes(":"));
          expect(header.title).toBeTypeOf("object");
          expect(header.title).not.toBeNull();
        }
      });

      (supportsHierarchy ? it : it.skip)("names a parent that is itself a header", async () => {
        const adapter = await createAdapter();
        const headers = await adapter.getRouteHeaders();
        const ids = new Set(headers.map((h) => h.id));

        const child = headers.find((h) => h.parentId !== null);
        expect(child, "the seed should include a nested route").toBeDefined();
        expect(ids.has(child!.parentId!)).toBe(true);
      });
    });

    describe("getMessages", () => {
      it("returns a flat map of ICU strings", async () => {
        const adapter = await createAdapter();
        const messages = await adapter.getMessages(f.defaultLocale);

        expect(Object.keys(messages).length).toBeGreaterThan(0);
        for (const value of Object.values(messages)) {
          expect(typeof value).toBe("string");
        }
      });

      it("returns an object, never null, for an unknown locale", async () => {
        // The app renders its bootstrap bundle when this is empty; a null
        // would mean every caller needs a guard.
        const adapter = await createAdapter();
        await expect(adapter.getMessages("zz")).resolves.toEqual({});
      });
    });

    describe("failure shape", () => {
      const maybe = createUnavailableAdapter ? describe : describe.skip;

      maybe("when the backend is unreachable", () => {
        it("throws ContentAdapterError with a retryable code", async () => {
          const adapter = await createUnavailableAdapter!();

          try {
            await adapter.getRouteManifest(f.defaultLocale);
            expect.unreachable("should have thrown");
          } catch (error) {
            expect(error).toBeInstanceOf(ContentAdapterError);
            const contentError = error as ContentAdapterError;
            expect(["unavailable", "timeout"]).toContain(contentError.code);
            // The UI decides whether to offer "retry" from this flag alone.
            expect(contentError.retryable).toBe(true);
          }
        });

        it("does not leak the vendor error into the message", async () => {
          const adapter = await createUnavailableAdapter!();

          try {
            await adapter.getMessages(f.defaultLocale);
            expect.unreachable("should have thrown");
          } catch (error) {
            // Vendor detail belongs on `cause`, for logs — not in a message
            // that might be rendered.
            expect(error).toBeInstanceOf(ContentAdapterError);
          }
        });
      });
    });
  });
}
