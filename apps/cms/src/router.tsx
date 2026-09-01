import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

/**
 * Unlike apps/shell's `getRouter()`, there is no locale strategy to thread
 * through — this app has no `i18n-core` dependency. It is an internal
 * authoring tool with one audience (whoever holds a CMS permission), not a
 * localized end-user surface, so it ships its own English chrome directly
 * rather than through the CMS it is itself the authoring tool for. See
 * README's "The CMS app" section for the full reasoning.
 */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
