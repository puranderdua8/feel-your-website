import { MockAuthProvider, type AuthProvider } from "@feel-your-website/auth";
import { SupabaseAuthProvider, type CookieAdapter } from "@feel-your-website/auth-supabase";
import { contractSeed, MemoryContentAdapter } from "@feel-your-website/content-adapter-memory";
import { SupabaseContentAdapter } from "@feel-your-website/content-adapter-supabase";
import type { ContentAdapter } from "@feel-your-website/content-core";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";

/**
 * The dependency-injection point. There is exactly one.
 *
 * This is the only module in the app that names a concrete adapter. Every
 * route, component and server function depends on the `ContentAdapter` and
 * `AuthProvider` interfaces, so swapping the backend is a change here and
 * nowhere else. If a `supabase-js` import ever appears outside an adapter
 * package, the seam has leaked.
 */

export type ContentAdapterKind = "memory" | "supabase";
export type AuthProviderKind = "mock" | "supabase";

function resolveContentAdapterKind(): ContentAdapterKind {
  const configured = process.env.CONTENT_ADAPTER ?? "memory";
  if (configured === "memory" || configured === "supabase") return configured;

  throw new Error(`Unknown CONTENT_ADAPTER "${configured}". Expected "memory" or "supabase".`);
}

function resolveAuthProviderKind(): AuthProviderKind {
  const configured = process.env.AUTH_PROVIDER ?? "mock";
  if (configured === "mock" || configured === "supabase") return configured;

  throw new Error(`Unknown AUTH_PROVIDER "${configured}". Expected "mock" or "supabase".`);
}

/**
 * Reads `SUPABASE_URL`/`SUPABASE_ANON_KEY`, shared by both Supabase-backed
 * adapters. Throws with the variable name rather than passing `undefined`
 * through to a client constructor, which would fail later with a URL-parsing
 * error that does not say which setting is missing.
 */
function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when using the Supabase adapter. Check your .env.`);
  }
  return value;
}

/**
 * Translates `@feel-your-website/auth-supabase`'s framework-agnostic
 * `CookieAdapter` into TanStack Start's actual request.
 *
 * Kept here rather than its own module: `seam.test.ts` enforces that exactly
 * one file may import a concrete backend package, and this glue has to name
 * `@feel-your-website/auth-supabase` for the `CookieAdapter` type it
 * implements — so it lives inside the one file that is allowed to.
 */
function tanstackCookieAdapter(): CookieAdapter {
  return {
    getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),

    setAll: (cookies, headers) => {
      for (const { name, value, options } of cookies) {
        // `@supabase/ssr`'s `CookieOptions` comes from the `cookie` npm
        // package; TanStack's `setCookie` expects `cookie-es`'s
        // `CookieSerializeOptions`. Both describe the same RFC 6265
        // attributes (path, maxAge, httpOnly, secure, sameSite, …) — the
        // packages differ only in where `sameSite`'s boolean shorthand is
        // typed, which `CookieAdapter`'s options already widened to match.
        setCookie(name, value, options);
      }

      // Required by `@supabase/ssr`'s contract for `setAll`: a response that
      // sets an auth cookie must tell any CDN or reverse proxy not to cache
      // it, or one signed-in user's session can be served to another.
      for (const [key, value] of Object.entries(headers)) {
        setResponseHeader(key, value);
      }
    },
  };
}

let contentAdapter: ContentAdapter | null = null;
let authProvider: AuthProvider | null = null;

export function getContentAdapter(): ContentAdapter {
  if (contentAdapter) return contentAdapter;

  const kind = resolveContentAdapterKind();
  contentAdapter =
    kind === "supabase"
      ? new SupabaseContentAdapter({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
        })
      : new MemoryContentAdapter(contractSeed);

  return contentAdapter;
}

export function getAuthProvider(): AuthProvider {
  if (authProvider) return authProvider;

  const kind = resolveAuthProviderKind();
  authProvider =
    kind === "supabase"
      ? new SupabaseAuthProvider({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
          // Lazy on purpose: `tanstackCookieAdapter()`'s `getAll`/`setAll`
          // read the *current* request's cookies each time they are called,
          // not at construction — so caching this provider below (built
          // once, reused across requests) stays correct. The cookie access
          // is what's per-request, not the provider instance.
          cookies: tanstackCookieAdapter(),
        })
      : new MockAuthProvider({
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
