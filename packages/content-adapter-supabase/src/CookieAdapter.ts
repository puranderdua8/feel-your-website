/**
 * The same tiny `getAll`/`setAll` shape `@feel-your-website/auth-supabase`
 * and `@feel-your-website/config-bundle-supabase` each declare for their own
 * session-carrying class, and for the same reason: `SupabaseContentWriter`'s
 * RPCs check `has_permission('manage:content')` against the *calling
 * session*, unlike `SupabaseContentAdapter`'s reads, which are anon and need
 * no session at all.
 *
 * Declared again here rather than imported from a sibling package so this
 * package does not depend on one merely for a structural type neither
 * package treats as its own concern — `apps/cms/src/server/adapters.ts`'s
 * `tanstackCookieAdapter()` satisfies all three by shape, with no cast
 * needed. See `auth-supabase/src/CookieAdapter.ts` for the original of this
 * note.
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

/** In-memory `CookieAdapter`, for the live test — a fresh, isolated session per instance. */
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
