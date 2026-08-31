import { CONFIG_CONTRACT_FIXTURE, runConfigBundleStoreContract } from "./contract-tests.js";
import { MemoryConfigBundleStore } from "./MemoryConfigBundleStore.js";

const vocabulary = new Set<string>([
  ...CONFIG_CONTRACT_FIXTURE.validItems,
  CONFIG_CONTRACT_FIXTURE.forbiddenItem,
]);

runConfigBundleStoreContract({
  name: "MemoryConfigBundleStore",
  createStore: () =>
    new MemoryConfigBundleStore({
      findUnknownItems: (items) => items.filter((item) => !vocabulary.has(item)),
      forbiddenItems: [CONFIG_CONTRACT_FIXTURE.forbiddenItem],
    }),
});
