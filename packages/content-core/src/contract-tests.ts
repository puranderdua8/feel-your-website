import { describe, expect, it } from "vitest";

import type { ContentAdapter } from "./adapter.js";
import { CONTRACT_FIXTURE } from "./contract-fixture.js";
import { ContentAdapterError } from "./errors.js";
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
}

// Re-exported so a suite can import fixture and runner from one place.
export { CONTRACT_FIXTURE };

export function runContentAdapterContract(options: ContentAdapterContractOptions): void {
  const { name, createAdapter, createUnavailableAdapter } = options;
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
        }
      });

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
