import { baseVitestConfig } from "@feel-your-website/config/vitest/base";
import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    test: {
      // Axe auditing a Radix component in jsdom regularly exceeds the 5s
      // default. That matters beyond one slow test: axe refuses to start
      // while a previous run is in flight, so a single timeout cascades into
      // "Axe is already running" failures for every test after it.
      testTimeout: 30_000,
      // Accessibility assertions share the global axe instance, so they must
      // not overlap.
      fileParallelism: false,
    },
  }),
);
