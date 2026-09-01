import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Same plugin-order rule as apps/shell: tailwindcss() before tanstackStart(),
// tanstackStart() before viteReact(). See that app's vite.config.ts for the
// full note.
//
// No `netlify()` plugin and no PWA here — root `netlify.toml` builds only
// `apps/shell` (see its own comment on why: one site, one publish dir), and
// this is an internal authoring tool, not something end users install.
// Deploying it is a later phase's decision, not a reason to carry build
// tooling this app does not yet use.
export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
