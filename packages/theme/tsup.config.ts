import { defineConfig } from "tsup";

export default defineConfig({
  // Two separate entries (not one barrel): "use client" only survives
  // bundling when it's the first line of its own output file. See
  // src/index.ts and src/client.ts for why they're split.
  entry: ["src/index.ts", "src/client.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  external: ["react", "react-dom"],
  onSuccess: "cp src/tailwind-preset.css dist/tailwind-preset.css",
});
