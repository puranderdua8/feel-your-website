import { AuthError, INVALID_CREDENTIALS_MESSAGE } from "./errors.js";
import type { AuthProvider, Credentials, Session } from "./types.js";

export interface MockAccount {
  userId: string;
  email: string;
  password: string;
  /** Permission claims this account's tokens carry. */
  permissions: readonly string[];
}

export interface MockAuthProviderOptions {
  accounts: readonly MockAccount[];
  /** Access-token lifetime in seconds. Short by default so refresh gets exercised. */
  tokenLifetimeSeconds?: number;
  /** Makes every call reject, to exercise the contract's failure shape. */
  failWith?: AuthError;
  /** Injected clock, so token expiry is testable without waiting. */
  now?: () => Date;
}

/**
 * An in-memory AuthProvider.
 *
 * This is the adapter development and tests run against, and the first to
 * satisfy the auth contract — so the contract exists before any real provider
 * is wired, rather than being reverse-engineered from Supabase's behaviour.
 */
export class MockAuthProvider implements AuthProvider {
  readonly #accounts: readonly MockAccount[];
  readonly #lifetimeSeconds: number;
  readonly #failWith?: AuthError;
  readonly #now: () => Date;

  #session: Session | null = null;

  constructor(options: MockAuthProviderOptions) {
    this.#accounts = options.accounts;
    this.#lifetimeSeconds = options.tokenLifetimeSeconds ?? 3600;
    this.#failWith = options.failWith;
    this.#now = options.now ?? (() => new Date());
  }

  async getSession(): Promise<Session | null> {
    this.#guard();
    // Signed-out is an ordinary state, not an error.
    return this.#session;
  }

  async signIn(credentials: Credentials): Promise<Session> {
    this.#guard();

    const account = this.#match(credentials);
    if (!account) {
      // Deliberately identical for "no such account" and "wrong password":
      // distinguishing them turns this into an enumeration oracle.
      throw new AuthError("invalid_credentials", INVALID_CREDENTIALS_MESSAGE);
    }

    this.#session = this.#issue(account);
    return this.#session;
  }

  async signOut(): Promise<void> {
    this.#guard();
    // Idempotent: signing out while already signed out is not an error.
    this.#session = null;
  }

  async refresh(): Promise<Session | null> {
    this.#guard();
    if (!this.#session) return null;

    const account = this.#accounts.find((candidate) => candidate.userId === this.#session?.userId);
    if (!account) {
      // The account went away underneath a live session — treat as revoked.
      this.#session = null;
      throw new AuthError("session_expired", "Session is no longer valid.");
    }

    // Re-reads permissions from the account, which is how a grant or
    // revocation reaches a signed-in user without them signing in again.
    this.#session = this.#issue(account);
    return this.#session;
  }

  /** Test seam: change an account's permissions to simulate a CMS role edit. */
  setPermissions(userId: string, permissions: readonly string[]): void {
    const account = this.#accounts.find((a) => a.userId === userId);
    if (account) {
      (account as { permissions: readonly string[] }).permissions = permissions;
    }
  }

  #match(credentials: Credentials): MockAccount | undefined {
    if (credentials.kind === "password") {
      return this.#accounts.find(
        (account) =>
          account.email === credentials.email && account.password === credentials.password,
      );
    }
    // The mock accepts a fixed OTP; real providers verify a sent code.
    return credentials.token === "000000"
      ? this.#accounts.find((account) => account.email === credentials.email)
      : undefined;
  }

  #issue(account: MockAccount): Session {
    const issuedAt = this.#now();
    const expiresAt = new Date(issuedAt.getTime() + this.#lifetimeSeconds * 1000);

    return {
      userId: account.userId,
      email: account.email,
      permissions: [...account.permissions],
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }
}
