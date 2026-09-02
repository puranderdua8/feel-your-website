import { runRouteCompositionWriterContract } from "@feel-your-website/content-core/route-composition-contract-tests";

import { MemoryContentAdapter } from "./MemoryContentAdapter.js";

/**
 * `MemoryContentAdapter` is the first `RouteCompositionWriter` to pass the
 * shared contract — the Supabase one runs the same behaviours against a live
 * database in the `supabase` CI job (`config-bundle-supabase`'s live test).
 *
 * A fresh, empty adapter per call: the suite creates and updates bundles, so
 * a shared instance would let one test's writes leak into the next.
 */
runRouteCompositionWriterContract({
  name: "MemoryContentAdapter",
  createWriter: () => new MemoryContentAdapter({ content: {}, routes: [] }),
});
