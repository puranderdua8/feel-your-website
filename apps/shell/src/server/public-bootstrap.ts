import { isContentAdapterError } from "@feel-your-website/content-core";
import { BOOTSTRAP_MESSAGES } from "@feel-your-website/i18n-core";

import { CMS_ROUTES } from "@/generated/cms-routes.js";

import { getContentAdapter } from "./adapters.js";
import { buildNav, knownRouteHeaders, type NavNode } from "./nav.js";

/**
 * The locale-scoped, visitor-independent half of the root bootstrap:
 * messages and nav, both sourced from the CMS. Shared by `loadBootstrap`
 * (the live request path, which adds the visitor's own session/consent on
 * top) and `generate-offline-data.ts` (which precaches this same shape per
 * locale as the offline seed for the root loader — plan finding 1).
 */
export interface PublicBootstrap {
  readonly messages: Record<string, string>;
  readonly nav: NavNode[];
  /** True when the CMS could not be reached — messages/nav are the bootstrap-only fallback. */
  readonly degraded: boolean;
}

export async function buildPublicBootstrap(locale: string): Promise<PublicBootstrap> {
  let messages: Record<string, string> = { ...BOOTSTRAP_MESSAGES };
  let nav: NavNode[] = [];
  let degraded = false;

  try {
    const adapter = getContentAdapter();
    const [fromCms, headers] = await Promise.all([
      adapter.getMessages(locale),
      // `getRouteHeaders`, never `getRouteManifest` — this call is on every
      // SSR navigation and must not pull section rows.
      adapter.getRouteHeaders(),
    ]);
    messages = { ...messages, ...fromCms };
    const knownRouteKeys = new Set(CMS_ROUTES.map((route) => route.routeKey));
    nav = buildNav(knownRouteHeaders(headers, knownRouteKeys), locale);
  } catch (error) {
    // A CMS outage must degrade to the bootstrap set and an empty nav, not to
    // a blank page. This is the whole reason that set exists.
    degraded = true;
    console.error(
      "[cms] content unavailable, serving bootstrap set:",
      isContentAdapterError(error) ? error.code : error,
    );
  }

  return { messages, nav, degraded };
}
