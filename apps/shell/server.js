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
// speaking its dialect — this is glue, not a framework.
import { fileURLToPath } from "node:url";

import { serve } from "srvx";
import { serveStatic } from "srvx/static";

import handler from "./dist/server/server.js";

const clientDir = fileURLToPath(new URL("./dist/client", import.meta.url));
const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

const server = serve({
  port,
  hostname,
  middleware: [
    // Content-hashed bundles under /assets/ never change; let browsers and
    // any proxy keep them indefinitely. Other static files (icons, the web
    // manifest, the service worker) keep serveStatic's conservative default.
    async (request, next) => {
      const response = await next();
      if (!response?.ok) return response;
      const { pathname } = new URL(request.url);
      try {
        if (pathname.startsWith("/assets/")) {
          response.headers.set("cache-control", "public, max-age=31536000, immutable");
        }
        // serveStatic has no mapping for .webmanifest.
        if (pathname.endsWith(".webmanifest")) {
          response.headers.set("content-type", "application/manifest+json");
        }
      } catch {
        // Some responses expose immutable headers — leave them as served.
      }
      return response;
    },
    serveStatic({ dir: clientDir }),
  ],
  fetch: (request) => handler.fetch(request),
});

await server.ready;
console.log(`shell listening on http://${hostname}:${port}`);
