import { defineConfig } from "tsup";

export default defineConfig({
  // Two entries, not one barrel: "use client" only survives bundling when
  // it is the first line of its own output file.
  entry: ["src/index.ts", "src/react.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["react", "react-dom"],
});
