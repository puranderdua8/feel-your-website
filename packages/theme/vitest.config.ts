import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "@feel-your-website/config/vitest/base";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
  }),
);
