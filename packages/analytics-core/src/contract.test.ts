import { runAnalyticsAdapterContract } from "./contract-tests.js";
import { MemoryAnalyticsAdapter } from "./memory-adapter.js";
import { NoopAnalyticsAdapter } from "./noop.js";

runAnalyticsAdapterContract({
  name: "NoopAnalyticsAdapter",
  createAdapter: () => new NoopAnalyticsAdapter(),
  // No observable surface — only the never-throws guarantees apply.
});

runAnalyticsAdapterContract({
  name: "MemoryAnalyticsAdapter",
  createAdapter: () => new MemoryAnalyticsAdapter(),
  delivered: (adapter) => (adapter as MemoryAnalyticsAdapter).tracked,
});
