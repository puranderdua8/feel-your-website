/**
 * The same tiny `getAll`/`setAll` shape `@feel-your-website/auth-supabase`
 * declares for its own `SupabaseAuthProvider`, and for the same reason: this
 * store's writes must run in the signed-in user's session, so it needs
 * `@supabase/ssr`'s cookie contract too.
 *
 * Declared again here rather than imported from `auth-supabase` so this
 * package does not depend on that one merely for a structural type neither
 * package treats as its own concern — `apps/cms/src/server/adapters.ts`'s
 * `tanstackCookieAdapter()` satisfies both by shape, with no cast needed.
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
 * An in-memory `CookieAdapter`, for the contract suite — a fresh, isolated
 * session per `createStore()` call, the same job `MemoryCookieAdapter` does
 * in `auth-supabase`.
 */
export class MemoryCookieAdapter implements CookieAdapter {
  readonly #store = new Map<string, string>();

  getAll(): CookieRecord[] {
    return [...this.#store.entries()].map(([name, value]) => ({ name, value }));
  }

  setAll(cookies: (CookieRecord & { options: SetCookieOptions })[]): void {
    for (const { name, value, options } of cookies) {
      if (options.maxAge !== undefined && options.maxAge <= 0) {
        this.#store.delete(name);
      } else {
        this.#store.set(name, value);
      }
    }
  }
}
