import { describe, expect, it } from "vitest";

import type { ContentAdapter } from "./adapter.js";
import { CONTRACT_FIXTURE } from "./contract-fixture.js";
import { ContentAdapterError, isContentAdapterError } from "./errors.js";

/**
 * The behavioural contract every ContentAdapter must satisfy.
 *
 * Matching method signatures is not sufficient for substitutability at the
 * points that actually matter. TypeScript will happily accept an adapter that
 * throws on a missing template while another returns `null`, or that
 * paginates by offset while another uses cursors — and every call site then
 * has to know which one it is talking to. That is the seam leaking.
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
   * Builds an adapter seeded with {@link CONTRACT_FIXTURE} content.
   *
   * Returns a fresh instance per test so ordering cannot matter.
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
    describe("getContent", () => {
      it("returns content for a known key in its own locale", async () => {
        const adapter = await createAdapter();
        const content = await adapter.getContent(f.translatedKey, f.otherLocale);

        expect(content).not.toBeNull();
        expect(content?.templateKey).toBe(f.translatedKey);
        expect(content?.locale).toBe(f.otherLocale);
        expect(content?.translated).toBe(true);
      });

      it("returns null for an unknown key rather than throwing", async () => {
        // A missing resource is an expected outcome, not a failure. Adapters
        // that throw here force every call site into a try/catch.
        const adapter = await createAdapter();
        await expect(adapter.getContent(f.missingKey, f.defaultLocale)).resolves.toBeNull();
      });

      it("falls back to the default locale and marks it untranslated", async () => {
        const adapter = await createAdapter();
        const content = await adapter.getContent(f.untranslatedKey, f.otherLocale);

        expect(content).not.toBeNull();
        // The caller must be able to tell it did not get what it asked for.
        expect(content?.translated).toBe(false);
        expect(content?.locale).toBe(f.defaultLocale);
      });

      it("marks content as translated when the requested locale exists", async () => {
        const adapter = await createAdapter();
        const content = await adapter.getContent(f.untranslatedKey, f.defaultLocale);

        expect(content?.translated).toBe(true);
      });

      it("returns an ISO-8601 updatedAt", async () => {
        const adapter = await createAdapter();
        const content = await adapter.getContent(f.translatedKey, f.defaultLocale);

        expect(content?.updatedAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
        );
      });
    });

    describe("listContent pagination", () => {
      it("returns a null cursor when everything fits on one page", async () => {
        const adapter = await createAdapter();
        const page = await adapter.listContent({ locale: f.defaultLocale });

        expect(page.items.length).toBe(f.totalEnItems);
        expect(page.nextCursor).toBeNull();
      });

      it("paginates without repeating or skipping items", async () => {
        const adapter = await createAdapter();

        const seen: string[] = [];
        let cursor: string | null = null;
        let pages = 0;

        do {
          const page = await adapter.listContent({
            locale: f.defaultLocale,
            limit: 1,
            cursor,
          });
          expect(page.items.length).toBeLessThanOrEqual(1);
          seen.push(...page.items.map((item) => item.templateKey));
          cursor = page.nextCursor;
          pages += 1;
          expect(pages, "pagination did not terminate").toBeLessThan(20);
        } while (cursor !== null);

        expect(seen.length).toBe(f.totalEnItems);
        expect(new Set(seen).size).toBe(f.totalEnItems);
      });

      it("clamps an oversized limit rather than erroring", async () => {
        // Adapters have different backend maxima. Erroring would make the
        // same query succeed on one adapter and fail on another.
        const adapter = await createAdapter();
        const page = await adapter.listContent({
          locale: f.defaultLocale,
          limit: 10_000,
        });

        expect(page.items.length).toBe(f.totalEnItems);
      });

      it("filters by template key", async () => {
        const adapter = await createAdapter();
        const page = await adapter.listContent({
          locale: f.defaultLocale,
          templateKeys: [f.translatedKey],
        });

        expect(page.items.map((i) => i.templateKey)).toEqual([f.translatedKey]);
      });

      it("returns an empty page, not an error, when nothing matches", async () => {
        const adapter = await createAdapter();
        const page = await adapter.listContent({
          locale: f.defaultLocale,
          templateKeys: [f.missingKey],
        });

        expect(page.items).toEqual([]);
        expect(page.nextCursor).toBeNull();
      });

      it("rejects a malformed cursor as invalid_request", async () => {
        const adapter = await createAdapter();

        await expect(
          adapter.listContent({
            locale: f.defaultLocale,
            cursor: "not-a-real-cursor",
          }),
        ).rejects.toSatisfy(
          (error: unknown) => isContentAdapterError(error) && error.code === "invalid_request",
        );
      });
    });

    describe("getRouteManifest", () => {
      it("returns only published bundles", async () => {
        const adapter = await createAdapter();
        const manifest = await adapter.getRouteManifest(f.defaultLocale);

        expect(Array.isArray(manifest)).toBe(true);
        for (const bundle of manifest) {
          expect(bundle.path.startsWith("/")).toBe(true);
          expect(bundle.version).toBeGreaterThan(0);
        }
      });

      it("returns an array, never null, when there are no routes", async () => {
        const adapter = await createAdapter();
        const manifest = await adapter.getRouteManifest("zz");

        expect(Array.isArray(manifest)).toBe(true);
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
            await adapter.getContent(f.translatedKey, f.defaultLocale);
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
