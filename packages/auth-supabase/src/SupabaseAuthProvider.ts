import {
  AuthError,
  INVALID_CREDENTIALS_MESSAGE,
  type AuthProvider,
  type Credentials,
  type Session,
} from "@feel-your-website/auth";
import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError, type SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapAuthError } from "./mapAuthError.js";
import { toSession } from "./toSession.js";

export interface SupabaseAuthProviderOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. RLS, not this key, is what protects data — see `.env.example`. */
  anonKey: string;
  /**
   * Where the session lives across requests. In `apps/shell` this is backed
   * by the request's own cookies; the contract suite uses an in-memory one so
   * each test gets a genuinely isolated session — see `CookieAdapter.ts`.
   */
  cookies: CookieAdapter;
  /** Test seam: makes every call reject, mirroring `MockAuthProvider`. */
  failWith?: AuthError;
}

/**
 * `AuthProvider` backed by Supabase Auth.
 *
 * The only place in the app that reads a token's claims directly. Every
 * `Session` this returns comes from `getClaims()` — never `getSession()`'s
 * own `session.user`, which the library's own docs call untrustworthy when
 * the storage medium is cookies, exactly the case here — so `app_permissions`
 * is always freshly verified, not merely carried along from whenever the
 * cookie was written.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly #client: SupabaseClient;
  readonly #failWith?: AuthError;

  constructor(options: SupabaseAuthProviderOptions) {
    this.#failWith = options.failWith;
    // Logs GoTrue's "multiple clients" warning under the contract suite,
    // which creates many short-lived instances — left as-is rather than
    // given a random storage key the way `SupabaseContentAdapter` is: unlike
    // that client, this one's whole job is finding a session an *earlier*
    // instance wrote to cookies, which needs a stable key across instances,
    // not a unique one. `@supabase/ssr`'s own docs say to create a fresh
    // client per request for exactly this reason — many short-lived
    // instances is the intended shape here, not the accident the warning
    // exists to catch.
    this.#client = createServerClient(options.url, options.anonKey, {
      cookies: {
        getAll: async () => await options.cookies.getAll(),
        setAll: async (cookies, headers) => {
          await options.cookies.setAll(cookies, headers);
        },
      },
    });
  }

  async getSession(): Promise<Session | null> {
    this.#guard();

    const { data, error } = await this.#client.auth.getSession();
    if (error) throw mapAuthError(error);
    if (!data.session) return null;

    return this.#verifiedSession(data.session.access_token);
  }

  async signIn(credentials: Credentials): Promise<Session> {
    this.#guard();

    const { data, error } =
      credentials.kind === "password"
        ? await this.#client.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          })
        : await this.#client.auth.verifyOtp({
            email: credentials.email,
            token: credentials.token,
            type: "email",
          });

    if (error) throw mapAuthError(error);
    if (!data.session) {
      // Reachable only for a flow this provider doesn't fully support (e.g.
      // an OTP type needing a follow-up step, not plain sign-in). Treated as
      // a rejected credential rather than a crash — the caller only knows
      // "sign-in failed" either way.
      throw new AuthError("invalid_credentials", INVALID_CREDENTIALS_MESSAGE);
    }

    return this.#verifiedSession(data.session.access_token);
  }

  async signOut(): Promise<void> {
    this.#guard();

    const { error } = await this.#client.auth.signOut();
    // Idempotent by contract: signing out while already signed out throws
    // AuthSessionMissingError from the underlying client, but is not a
    // failure from this interface's point of view.
    if (error && !isAuthSessionMissingError(error)) throw mapAuthError(error);
  }

  async refresh(): Promise<Session | null> {
    this.#guard();

    // Checked first and deliberately not folded into the refresh call below:
    // "nothing to refresh" must return null, not throw, and GoTrue's own
    // refresh error for a missing session is not reliably distinguishable
    // from other rejections without this.
    const { data: existing } = await this.#client.auth.getSession();
    if (!existing.session) return null;

    const { data, error } = await this.#client.auth.refreshSession();
    if (error) throw mapAuthError(error);
    if (!data.session) return null;

    return this.#verifiedSession(data.session.access_token);
  }

  async #verifiedSession(accessToken: string): Promise<Session> {
    const { data, error } = await this.#client.auth.getClaims(accessToken);
    if (error || !data) throw mapAuthError(error);

    return toSession(data.claims);
  }

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }
}
