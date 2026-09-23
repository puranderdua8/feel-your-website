import { ThemeProvider } from "@feel-your-website/theme/client";
import { ConsentProvider } from "@feel-your-website/consent-core/react";
import { BOOTSTRAP_MESSAGES } from "@feel-your-website/i18n-core";
import { I18nProvider } from "@feel-your-website/i18n-core/react";
import { PermissionsProvider } from "@feel-your-website/rbac/react";
import { createRootRoute, HeadContent, Outlet, redirect, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppAnalyticsProvider } from "@/analytics/provider";
import { ConsentBanner } from "@/components/consent-banner";
import { ServiceWorkerNotice } from "@/components/service-worker";
import { SiteNav } from "@/components/site-nav";
import { refreshOfflineBootstrap } from "@/offline-refresh";
import { loadBootstrap, type BootstrapPayload, type NavNode } from "@/server/bff";
import { ANALYTICS_OFF } from "@/server/config/analytics.js";
import { readOfflineLocale } from "@/server/offline-locale";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  // A raw request for a non-canonical URL (a trailing slash, a doubled `/`)
  // gets redirected here. `trailingSlash: 'never'` (router.tsx) only affects
  // the router's own internal matching — it doesn't rewrite what a direct hit
  // on `/blog/` shows in the address bar. Runs before every loader, on every
  // request, so the redirect is the very first thing the server does.
  //
  // Requests `statusCode: 301` (permanent), but verified against both `vite
  // dev` and the production `node server.js` build: this TanStack Start
  // version (`@tanstack/react-start` ^1.168) always sends `307` for a
  // `beforeLoad`-thrown redirect during SSR, regardless of the requested
  // code — a deliberate framework choice, not a bug here (a redirect thrown
  // mid-match isn't one a browser/CDN should cache permanently). Left as
  // `301` anyway: it's the technically correct intent, costs nothing, and a
  // future TanStack version honouring it needs no change here.
  beforeLoad: ({ location }) => {
    const canonical = canonicalPathname(location.pathname);
    if (canonical === location.pathname) return;
    const hash = location.hash ? `#${location.hash}` : "";
    throw redirect({ href: `${canonical}${location.searchStr}${hash}`, statusCode: 301 });
  },
  // One call for locale, messages and permissions, resolved server-side
  // before the first paint. Fetching them separately would stack a waterfall
  // in front of every page.
  //
  // The locale needs no argument: it rides on the request cookie, so the
  // server resolves it before rendering anything.
  //
  // Offline, with nothing cached for this exact request, `loadBootstrap`
  // itself can't be reached — every child route's own loader depends on this
  // one succeeding first, so falling back here is what makes any offline
  // route (plan finding 1) reachable at all, not just its own content.
  loader: async (): Promise<BootstrapPayload> => {
    try {
      const bootstrap = await loadBootstrap();
      // Only a genuine online success refreshes the offline seed — the
      // fallback below reads that same seed (or a placeholder, if there
      // isn't one yet), and writing either of those back would either be a
      // no-op or, worse, overwrite a real seed with the placeholder.
      refreshOfflineBootstrap(bootstrap);
      return bootstrap;
    } catch {
      return loadOfflineBootstrap();
    }
  },
  // Every generated `(cms)/**` file's `cmsLoader` `throw notFound()`s for an
  // unknown or unpublished routeKey. Configured here, at the root, rather
  // than per-route, so it is also what TanStack Router itself falls back to
  // for any path no route file claims at all — one component covers both
  // "no CMS route" and "no route file", which are the same experience for a
  // visitor either way.
  notFoundComponent: NotFoundPage,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "feel-your-website" },
      { name: "theme-color", content: "#ffffff" },
      // iOS ignores the web manifest's `display` field; without these an
      // installed icon still opens in Safari chrome rather than standalone.
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Without this link the manifest is never fetched and the app is not
      // installable, however complete the manifest itself is.
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icons/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/icons/icon-192.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const bootstrap = Route.useLoaderData();

  return (
    <RootDocument locale={bootstrap.locale}>
      {/*
        Consent wraps analytics: `AppAnalyticsProvider` reads `useConsent()` to
        gate every emit. Both are mounted unconditionally — with no
        `ANALYTICS_PROVIDER` set the adapter is a no-op and nothing is sent.
      */}
      <ConsentProvider initial={bootstrap.consent}>
        <AppAnalyticsProvider config={bootstrap.analytics}>
          <I18nProvider locale={bootstrap.locale} messages={bootstrap.messages}>
            {/*
              Permissions are resolved on the server and passed down. The client
              never derives them from roles — a client-side decision is a display
              decision, and every one of these is also enforced server-side.
            */}
            <PermissionsProvider permissions={new Set(bootstrap.permissions)}>
              <ThemeProvider theme="base">
                <ServiceWorkerNotice />
                <SiteNav nav={bootstrap.nav} />
                <Outlet />
              </ThemeProvider>
            </PermissionsProvider>
          </I18nProvider>
        </AppAnalyticsProvider>
        <ConsentBanner />
      </ConsentProvider>
    </RootDocument>
  );
}

/**
 * Collapses duplicate slashes and strips a trailing slash (except root) —
 * the request-path canonicalisation `normalizeRequestPath` (content-core)
 * used to do for the hand-rolled matcher. Deliberately leaves case alone: an
 * uppercase segment simply won't match any generated route (the slug rule
 * makes every one lowercase), and blindly lowercasing here could turn a
 * legitimate mixed-case `:param` value (a `:slug` an author published with
 * capitals) into a redirect to a URL nothing actually publishes.
 */
export function canonicalPathname(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 && collapsed.endsWith("/") ? collapsed.slice(0, -1) : collapsed;
}

/**
 * Builds the offline fallback's `BootstrapPayload` — no session: an offline
 * visitor is anonymous and permission-less, same as anyone who has never
 * signed in. `degraded: true` for the same reason `loadBootstrap`'s own CMS-
 * outage path sets it: `messages`/`nav` are a fallback, not live content.
 */
export function offlineBootstrapPayload(
  locale: string,
  messages: Record<string, string>,
  nav: NavNode[],
): BootstrapPayload {
  return {
    locale,
    messages,
    permissions: [],
    userId: null,
    degraded: true,
    nav,
    analytics: ANALYTICS_OFF,
    consent: "unknown",
  };
}

/**
 * `loadBootstrap`'s offline fallback: the precached `_bootstrap-<locale>.json`
 * seed (`generate-offline-data.ts`) for the visitor's own locale (read from
 * the cookie directly — there is no server to ask). Falls back further, to
 * the bootstrap message set and an empty nav, when no such seed exists at
 * all (no route is offline in this build, or the browser truly has nothing
 * cached) — the same shape `loadBootstrap` itself already falls back to on a
 * CMS outage while online.
 */
async function loadOfflineBootstrap(): Promise<BootstrapPayload> {
  const locale = readOfflineLocale();
  const response = await fetch(`/offline-data/_bootstrap-${locale}.json`).catch(() => null);
  if (response?.ok) {
    const seed = (await response.json()) as { messages: Record<string, string>; nav: NavNode[] };
    return offlineBootstrapPayload(locale, seed.messages, seed.nav);
  }
  return offlineBootstrapPayload(locale, { ...BOOTSTRAP_MESSAGES }, []);
}

/**
 * Plain English, deliberately, unlike the rest of this app's copy: this is
 * what renders when there is no CMS content to fall back to in the first
 * place — the whole reason a route led here — so it cannot itself depend on
 * a `bootstrap.*` message key existing. Same reasoning as `apps/cms`'s own
 * hardcoded chrome.
 */
function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">No published route exists at this address.</p>
    </main>
  );
}

function RootDocument({ children, locale }: Readonly<{ children: ReactNode; locale: string }>) {
  return (
    // `lang` tracks the negotiated locale so screen readers and hyphenation
    // follow the content rather than always announcing English.
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
