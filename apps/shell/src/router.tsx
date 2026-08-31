import { createRouter } from "@tanstack/react-router";

import { routerLocaleOptions } from "./i18n/strategy.ui";
import { routeTree } from "./routeTree.gen";

/**
 * Locale-agnostic by construction.
 *
 * Whether the locale appears in the address is the strategy's decision, and
 * it arrives here as `routerLocaleOptions`. Under the cookie strategy that is
 * empty; a URL strategy supplies a `rewrite` pair so one route tree still
 * serves every language. Either way this file stays as it is.
 */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Empty under the cookie strategy; the URL strategy supplies a rewrite
    // pair here. Either way this file does not change.
    ...routerLocaleOptions,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
