import { describe, expect, it } from "vitest";

import { AuthError, isAuthError } from "./errors.js";
import type { AuthProvider } from "./types.js";

/**
 * The behavioural contract every AuthProvider must satisfy.
 *
 * The mock and the real Supabase provider run this identical suite. Without
 * it, "swappable auth" means only that both expose a `signIn` — while one
 * returns null for a signed-out user and the other throws, and every caller
 * has to know which.
 */
export interface AuthProviderContractOptions {
  name: string;
  /** A fresh, signed-out provider seeded with {@link AUTH_CONTRACT_FIXTURE}. */
  createProvider: () => Promise<AuthProvider> | AuthProvider;
  /** A provider whose backend is unreachable. Omit to skip failure-shape tests. */
  createUnavailableProvider?: () => Promise<AuthProvider> | AuthProvider;
}

export const AUTH_CONTRACT_FIXTURE = {
  email: "surveyor@example.com",
  password: "correct-horse-battery-staple",
  wrongPassword: "hunter2",
  unknownEmail: "nobody@example.com",
  permissions: ["capture:audio"],
} as const;

export function runAuthProviderContract(options: AuthProviderContractOptions): void {
  const { name, createProvider, createUnavailableProvider } = options;
  const f = AUTH_CONTRACT_FIXTURE;

  const signIn = (provider: AuthProvider) =>
    provider.signIn({
      kind: "password",
      email: f.email,
      password: f.password,
    });

  describe(`AuthProvider contract: ${name}`, () => {
    describe("getSession", () => {
      it("returns null when signed out rather than throwing", async () => {
        // Signed-out is an ordinary state. Throwing would wrap every route
        // load in a try/catch.
        const provider = await createProvider();
        await expect(provider.getSession()).resolves.toBeNull();
      });

      it("returns the session after signing in", async () => {
        const provider = await createProvider();
        await signIn(provider);

        const session = await provider.getSession();
        expect(session?.email).toBe(f.email);
      });
    });

    describe("signIn", () => {
      it("returns a session carrying permission claims", async () => {
        const provider = await createProvider();
        const session = await signIn(provider);

        expect(session.userId).toBeTruthy();
        expect([...session.permissions]).toEqual([...f.permissions]);
      });

      it("issues ISO-8601 timestamps with expiry after issuance", async () => {
        const provider = await createProvider();
        const session = await signIn(provider);

        expect(Date.parse(session.issuedAt)).not.toBeNaN();
        expect(Date.parse(session.expiresAt)).toBeGreaterThan(Date.parse(session.issuedAt));
      });

      it("rejects a wrong password as invalid_credentials, not retryable", async () => {
        const provider = await createProvider();

        try {
          await provider.signIn({
            kind: "password",
            email: f.email,
            password: f.wrongPassword,
          });
          expect.unreachable("should have thrown");
        } catch (error) {
          expect(isAuthError(error)).toBe(true);
          expect((error as AuthError).code).toBe("invalid_credentials");
          // Retrying resends the same wrong password; offering "try again"
          // would be misleading.
          expect((error as AuthError).retryable).toBe(false);
        }
      });

      it("does not reveal whether the account exists", async () => {
        // Different messages here turn the sign-in form into an
        // account-enumeration oracle.
        const provider = await createProvider();

        const messages: string[] = [];
        for (const credentials of [
          { kind: "password", email: f.email, password: f.wrongPassword },
          { kind: "password", email: f.unknownEmail, password: f.wrongPassword },
        ] as const) {
          try {
            await provider.signIn(credentials);
            expect.unreachable("should have thrown");
          } catch (error) {
            messages.push((error as Error).message);
          }
        }

        expect(messages[0]).toBe(messages[1]);
      });

      it("leaves no session behind after a failed attempt", async () => {
        const provider = await createProvider();
        await provider
          .signIn({
            kind: "password",
            email: f.email,
            password: f.wrongPassword,
          })
          .catch(() => undefined);

        await expect(provider.getSession()).resolves.toBeNull();
      });
    });

    describe("signOut", () => {
      it("clears the session", async () => {
        const provider = await createProvider();
        await signIn(provider);
        await provider.signOut();

        await expect(provider.getSession()).resolves.toBeNull();
      });

      it("is idempotent", async () => {
        // Callers sign out defensively (e.g. on an auth error) without first
        // checking whether a session exists.
        const provider = await createProvider();
        await expect(provider.signOut()).resolves.toBeUndefined();
        await expect(provider.signOut()).resolves.toBeUndefined();
      });
    });

    describe("refresh", () => {
      it("returns null when there is nothing to refresh", async () => {
        const provider = await createProvider();
        await expect(provider.refresh()).resolves.toBeNull();
      });

      it("returns a session when signed in", async () => {
        const provider = await createProvider();
        await signIn(provider);

        const refreshed = await provider.refresh();
        expect(refreshed?.userId).toBeTruthy();
      });

      it("is the path by which changed permissions reach a signed-in user", async () => {
        // Claims are baked into a token at issuance, so a role edit only
        // reaches an existing session here. Grants tolerate that lag;
        // revocations are additionally backed by a server-side check.
        const provider = await createProvider();
        const before = await signIn(provider);
        const after = await provider.refresh();

        expect(after).not.toBeNull();
        expect([...(after as NonNullable<typeof after>).permissions]).toEqual([
          ...before.permissions,
        ]);
      });
    });

    describe("failure shape", () => {
      const maybe = createUnavailableProvider ? describe : describe.skip;

      maybe("when the provider is unreachable", () => {
        it("throws a retryable AuthError from getSession", async () => {
          const provider = await createUnavailableProvider!();

          try {
            await provider.getSession();
            expect.unreachable("should have thrown");
          } catch (error) {
            expect(isAuthError(error)).toBe(true);
            const authError = error as AuthError;
            expect(["unavailable", "timeout"]).toContain(authError.code);
            expect(authError.retryable).toBe(true);
          }
        });

        it("distinguishes transport failure from rejected credentials", async () => {
          // Collapsing these would tell a user their password was wrong when
          // the network was actually down.
          const provider = await createUnavailableProvider!();

          try {
            await signIn(provider);
            expect.unreachable("should have thrown");
          } catch (error) {
            expect((error as AuthError).code).not.toBe("invalid_credentials");
          }
        });
      });
    });
  });
}
