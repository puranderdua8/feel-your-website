/**
 * The dependency `SupabaseAuthProvider` needs to persist a session, expressed
 * independently of any one framework's cookie APIs.
 *
 * This is deliberately the same `getAll`/`setAll` shape `@supabase/ssr`
 * itself expects — `SupabaseAuthProvider`'s constructor passes one straight
 * through. Two implementations exist: `apps/shell/src/server/adapters.ts`
 * has a `tanstackCookieAdapter()` backed by TanStack Start's request, kept
 * inside that file rather than its own module because `seam.test.ts`
 * enforces that only `adapters.ts` may import a concrete backend package,
 * and this one is; the contract suite wires an in-memory one per test so
 * each `createProvider()` call is a truly fresh, isolated session store —
 * see `MemoryCookieAdapter` below.
 */

export interface CookieRecord {
  name: string;
  value: string;
}

export interface SetCookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  // `@supabase/ssr` gets this shape from the `cookie` package, which permits
  // the boolean shorthand (`true` for "strict") alongside the named values —
  // matched here rather than narrowed, since this type only ever describes
  // options `@supabase/ssr` itself produces, never one this package writes.
  sameSite?: boolean | "strict" | "lax" | "none";
}

export interface CookieAdapter {
  getAll(): CookieRecord[] | Promise<CookieRecord[]>;
  setAll(
    cookies: (CookieRecord & { options: SetCookieOptions })[],
    headers: Record<string, string>,
  ): void | Promise<void>;
}

/**
 * An in-memory `CookieAdapter`, for the contract suite.
 *
 * The contract requires `createProvider()` to return "a fresh, signed-out
 * provider" per test, with no state leaking between tests — real cookies
 * would need a browser or a fake `Request`/`Response` pair to achieve that;
 * a plain `Map` is the whole mechanism a test needs.
 */
export class MemoryCookieAdapter implements CookieAdapter {
  readonly #store = new Map<string, string>();

  getAll(): CookieRecord[] {
    return [...this.#store.entries()].map(([name, value]) => ({ name, value }));
  }

  setAll(cookies: (CookieRecord & { options: SetCookieOptions })[]): void {
    for (const { name, value, options } of cookies) {
      // A real cookie store would drop the entry on `maxAge <= 0` (how
      // `@supabase/ssr` clears a cookie on sign-out); a `Map` needs that
      // spelled out explicitly.
      if (options.maxAge !== undefined && options.maxAge <= 0) {
        this.#store.delete(name);
      } else {
        this.#store.set(name, value);
      }
    }
  }
}
