import netlify from "@netlify/vite-plugin-tanstack-start";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Same plugin-order rule as apps/shell: tailwindcss() before tanstackStart(),
// tanstackStart() before netlify(), netlify() before viteReact(). See that
// app's vite.config.ts for the full note on why the order is load-bearing.
//
// Still no PWA/service worker here — this is an internal authoring tool, not
// something end users install, and that reasoning hasn't changed. The
// `netlify()` adapter is new: this app is now its own Netlify site, separate
// from apps/shell's — see apps/cms/netlify.toml.
export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), tanstackStart(), netlify(), viteReact()],
});
