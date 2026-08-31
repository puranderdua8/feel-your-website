import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Plugin order is load-bearing: tailwindcss() before tanstackStart(),
// tanstackStart() before viteReact(). See TanStack Start's Vite plugin
// ordering docs — getting this wrong fails at build time, not runtime.
export default defineConfig({
  server: {
    port: 3000,
  },
  // Vite does not read tsconfig `paths`, so the "@/*" alias has to be declared
  // here as well as in tsconfig.json (which only informs tsc and the editor).
  // vitest.config.ts needs its own copy for the same reason.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
