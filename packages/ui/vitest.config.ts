import { baseVitestConfig } from "@feel-your-website/config/vitest/base";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    test: {
      // Axe auditing a Radix component in jsdom is slow, and wildly variable:
      // Select takes ~1s on a developer machine and was seen taking 32s on a
      // 2-core CI runner, where Turbo has nine test suites competing at once.
      //
      // This matters beyond one slow test. Axe refuses to start while a
      // previous run is in flight, so a single timeout cascades into "Axe is
      // already running" failures for every test after it — one slow audit
      // fails the whole suite.
      //
      // A timeout is a ceiling, not a delay: a generous one costs nothing
      // when tests pass, and buys immunity from a machine having a bad day.
      testTimeout: 120_000,
      // Accessibility assertions share one global axe instance, so suites
      // must not overlap.
      fileParallelism: false,
    },
  }),
);
