import { runAuthProviderContract, AUTH_CONTRACT_FIXTURE } from "./contract-tests.js";
import { AuthError } from "./errors.js";
import { MockAuthProvider } from "./MockAuthProvider.js";

const accounts = [
  {
    userId: "user-1",
    email: AUTH_CONTRACT_FIXTURE.email,
    password: AUTH_CONTRACT_FIXTURE.password,
    permissions: [...AUTH_CONTRACT_FIXTURE.permissions],
  },
];

runAuthProviderContract({
  name: "MockAuthProvider",
  createProvider: () => new MockAuthProvider({ accounts }),
  createUnavailableProvider: () =>
    new MockAuthProvider({
      accounts,
      failWith: new AuthError("unavailable", "Auth backend unreachable."),
    }),
});
