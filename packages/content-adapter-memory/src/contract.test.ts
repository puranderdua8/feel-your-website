import { ContentAdapterError } from "@feel-your-website/content-core";
import { runContentAdapterContract } from "@feel-your-website/content-core/contract-tests";

import { contractSeed } from "./fixtures.js";
import { MemoryContentAdapter } from "./MemoryContentAdapter.js";

/**
 * The whole point of this file is that it contains no assertions of its own.
 *
 * Every expectation lives in the shared suite, so when the Supabase adapter
 * arrives it runs this identical contract. Two adapters passing the same
 * executable specification is what "the CMS is replaceable" actually means.
 */
runContentAdapterContract({
  name: "MemoryContentAdapter",
  createAdapter: () => new MemoryContentAdapter(contractSeed),
  createUnavailableAdapter: () =>
    new MemoryContentAdapter(contractSeed, {
      failWith: new ContentAdapterError("unavailable", "Backend unreachable."),
    }),
});
