import { ACTION_CONTRACT_FIXTURE, runActionInvokerContract } from "./contract-tests.js";
import { MemoryActionInvoker } from "./MemoryActionInvoker.js";

runActionInvokerContract({
  name: "MemoryActionInvoker",
  createInvoker: () =>
    new MemoryActionInvoker({
      seed: { [ACTION_CONTRACT_FIXTURE.knownId]: { hello: "world" } },
    }),
  createUnavailableInvoker: () => new MemoryActionInvoker({ failWith: "unavailable" }),
});
