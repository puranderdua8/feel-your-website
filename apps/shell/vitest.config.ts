import { baseVitestConfig } from "@feel-your-website/config/vitest/base";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  baseVitestConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  }),
);
