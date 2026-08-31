import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Shared Vitest base config. Individual packages merge this with their own
 * `vitest.config.ts` (e.g. via `mergeConfig`) to add package-specific
 * plugins (like `@vitejs/plugin-react`).
 *
 * Plain JS (not .ts): Vite's config-file loader leaves bare-specifier
 * imports (like `@puranderdua8/config/vitest/base`) unbundled, so Node
 * resolves this file directly at config-load time — a `.ts` file there
 * fails with ERR_UNKNOWN_FILE_EXTENSION since nothing transforms it first.
 *
 * @type {import("vitest/config").UserConfig}
 */
export const baseVitestConfig = defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: [fileURLToPath(new URL("./setup.ts", import.meta.url))],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});

export default baseVitestConfig;
