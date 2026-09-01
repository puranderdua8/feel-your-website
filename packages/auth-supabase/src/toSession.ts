import type { Session } from "@feel-your-website/auth";

/**
 * The shape `getClaims()` actually returns: verified JWT claims, with an
 * index signature for whatever the Custom Access Token hook added — see
 * `supabase/migrations/..._auth_hook.sql`. Declared locally rather than
 * imported from `@supabase/auth-js` because that type is `any`-indexed and
 * gives no guarantee `app_permissions` is what the hook put there; this
 * function is the one place that assumption gets checked.
 */
export interface VerifiedClaims {
  sub: string;
  email?: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/**
 * Maps verified JWT claims to the platform's vendor-neutral `Session`.
 *
 * A pure function on purpose: it is the one place that has to agree with
 * what `custom_access_token_hook` actually stamps into a token, so it is
 * tested in isolation rather than only indirectly through a live sign-in.
 */
export function toSession(claims: VerifiedClaims): Session {
  const permissions = Array.isArray(claims.app_permissions)
    ? claims.app_permissions.filter((value): value is string => typeof value === "string")
    : [];

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    permissions,
    issuedAt: new Date(claims.iat * 1000).toISOString(),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}
