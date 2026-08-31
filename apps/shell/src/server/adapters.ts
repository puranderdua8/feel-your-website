import { MockAuthProvider, type AuthProvider } from "@feel-your-website/auth";
import { contractSeed, MemoryContentAdapter } from "@feel-your-website/content-adapter-memory";
import type { ContentAdapter } from "@feel-your-website/content-core";

/**
 * The dependency-injection point. There is exactly one.
 *
 * This is the only module in the app that names a concrete adapter. Every
 * route, component and server function depends on the `ContentAdapter` and
 * `AuthProvider` interfaces, so swapping the backend is a change here and
 * nowhere else. If a `supabase-js` import ever appears outside an adapter
 * package, the seam has leaked.
 */

export type AdapterKind = "memory" | "supabase";

function resolveKind(): AdapterKind {
  const configured = process.env.CONTENT_ADAPTER ?? "memory";
  if (configured === "memory" || configured === "supabase") return configured;

  throw new Error(`Unknown CONTENT_ADAPTER "${configured}". Expected "memory" or "supabase".`);
}

let contentAdapter: ContentAdapter | null = null;
let authProvider: AuthProvider | null = null;

export function getContentAdapter(): ContentAdapter {
  if (contentAdapter) return contentAdapter;

  const kind = resolveKind();
  if (kind === "supabase") {
    // Phase 5. Failing loudly beats silently serving fixtures in production.
    throw new Error(
      "The Supabase content adapter is not implemented yet (Phase 5). Set CONTENT_ADAPTER=memory.",
    );
  }

  contentAdapter = new MemoryContentAdapter(contractSeed);
  return contentAdapter;
}

export function getAuthProvider(): AuthProvider {
  if (authProvider) return authProvider;

  authProvider = new MockAuthProvider({
    accounts: [
      {
        userId: "user-surveyor",
        email: "surveyor@example.com",
        password: "demo",
        permissions: [],
      },
      {
        userId: "user-manager",
        email: "manager@example.com",
        password: "demo",
        permissions: ["manage:content", "manage:routes"],
      },
    ],
  });

  return authProvider;
}

/** Test seam: forces the next call to rebuild from current env. */
export function resetAdapters(): void {
  contentAdapter = null;
  authProvider = null;
}
