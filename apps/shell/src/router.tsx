import { createRouter } from "@tanstack/react-router";

import { DefaultErrorComponent, DefaultPendingComponent } from "./components/route-fallbacks";
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
    // Already this version's default; set explicitly so it's load-bearing
    // documentation, not an accident of upstream defaults changing under us.
    // Only affects the router's own matching — `__root.tsx`'s `beforeLoad`
    // is what 301s a raw request for a non-canonical URL.
    trailingSlash: "never",
    // A generated route's `loader` fetches on every entry by default; hovering
    // (or tapping, on touch) a `<Link>` starts that fetch ahead of the actual
    // click, so a fast follow-through never blocks on it.
    defaultPreload: "intent",
    // Re-navigating to an already-loaded route within this window reuses its
    // data instead of re-fetching — a quick back/forward shouldn't re-hit the
    // CMS. Short on purpose: this platform's whole design promise is that
    // published content is instant, not cached across a real revisit.
    defaultStaleTime: 10_000,
    // Generated route files stay thin (no per-file loading/error UI) because
    // these two defaults cover every one of them.
    defaultPendingComponent: DefaultPendingComponent,
    defaultErrorComponent: DefaultErrorComponent,
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
