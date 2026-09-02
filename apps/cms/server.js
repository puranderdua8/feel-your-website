// Production Node entrypoint for the container image (see Dockerfile).
//
// `vite build` produces a host-agnostic output: dist/client/ (static assets)
// and dist/server/server.js, whose default export is a Web `{ fetch }`
// handler — the exact shape Netlify's adapter wraps for its platform. This
// file is the equivalent wrapper for a plain Node host: serve dist/client
// first, hand everything else (SSR, /_serverFn/*) to that handler, and
// listen on $PORT.
//
// srvx is TanStack Start's own server layer, so `handler.fetch` is already
// speaking its dialect — this is glue, not a framework. Kept as its own file
// rather than shared with apps/shell's copy: that one also fixes up a PWA
// manifest this app does not ship.
import { fileURLToPath } from "node:url";

import { serve } from "srvx";
import { serveStatic } from "srvx/static";

import handler from "./dist/server/server.js";

const clientDir = fileURLToPath(new URL("./dist/client", import.meta.url));
const port = Number(process.env.PORT) || 3001;
const hostname = process.env.HOST || "0.0.0.0";

const server = serve({
  port,
  hostname,
  middleware: [
    // Content-hashed bundles under /assets/ never change; let browsers and
    // any proxy keep them indefinitely.
    async (request, next) => {
      const response = await next();
      if (response?.ok && new URL(request.url).pathname.startsWith("/assets/")) {
        try {
          response.headers.set("cache-control", "public, max-age=31536000, immutable");
        } catch {
          // Some responses expose immutable headers — leave them as served.
        }
      }
      return response;
    },
    serveStatic({ dir: clientDir }),
  ],
  fetch: (request) => handler.fetch(request),
});

await server.ready;
console.log(`cms listening on http://${hostname}:${port}`);
