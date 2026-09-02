import { defineConfig } from "tsup";

export default defineConfig({
  // contract-tests is a separate entry so it never gets pulled into an app
  // bundle by a barrel import — it depends on vitest.
  entry: ["src/index.ts", "src/contract-tests.ts", "src/route-composition-contract-tests.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["vitest"],
});
