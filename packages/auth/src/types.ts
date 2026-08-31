/**
 * A signed-in subject, as the platform sees it.
 *
 * Vendor-neutral by construction: Supabase's `User`, Cognito's `IdToken`
 * claims and Auth0's profile all stop at the adapter and are mapped into
 * this. Apps depend on this shape, never on a vendor SDK type.
 */
export interface Session {
  userId: string;
  email?: string;

  /**
   * Permission strings carried in the access token's claims.
   *
   * These are *claims*, not the authority. They are resolved against the
   * code catalog before use (see `@feel-your-website/rbac`), because a token
   * can name a permission the code has since removed.
   */
  permissions: readonly string[];

  /**
   * When the access token was issued, ISO-8601.
   *
   * Load-bearing for revocation: custom claims only refresh when a token is
   * reissued, so a revoked permission can linger in a valid token. Comparing
   * this against the subject's `permissionsUpdatedAt` is what lets a
   * sensitive route detect a stale claim instead of trusting it.
   */
  issuedAt: string;

  /** When the access token expires, ISO-8601. */
  expiresAt: string;
}

/**
 * How a subject proves identity.
 *
 * A discriminated union rather than a bag of optional fields, so adding a
 * method (OAuth, passkey) cannot silently make an existing call ambiguous.
 */
export type Credentials =
  | { kind: "password"; email: string; password: string }
  | { kind: "otp"; email: string; token: string };

/**
 * Swappable authentication, per the architecture's provider-agnostic
 * requirement. Supabase Auth is the default implementation; the mock is what
 * development and tests run against.
 */
export interface AuthProvider {
  /**
   * The current session, or `null` when signed out.
   *
   * Signed-out is an ordinary state, not a failure — throwing here would put
   * a try/catch around every route load.
   */
  getSession(): Promise<Session | null>;

  /** Exchanges credentials for a session. Throws `AuthError` on rejection. */
  signIn(credentials: Credentials): Promise<Session>;

  /** Ends the session. Idempotent: signing out when already out is not an error. */
  signOut(): Promise<void>;

  /**
   * Renews the access token, returning the new session, or `null` if there is
   * nothing to renew. This is where updated permission claims arrive.
   */
  refresh(): Promise<Session | null>;
}
