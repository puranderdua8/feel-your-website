import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/contract-tests.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["vitest"],
});
