import { ThemeProvider } from "@puranderdua8/theme/client";
import { I18nProvider } from "@feel-your-website/i18n-core/react";
import { PermissionsProvider } from "@feel-your-website/rbac/react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ServiceWorkerNotice } from "@/components/service-worker";
import { loadBootstrap, type BootstrapPayload } from "@/server/bff";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  // One call for locale, messages and permissions, resolved server-side
  // before the first paint. Fetching them separately would stack a waterfall
  // in front of every page.
  //
  // The locale needs no argument: it rides on the request cookie, so the
  // server resolves it before rendering anything.
  loader: async (): Promise<BootstrapPayload> => loadBootstrap(),
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
      <I18nProvider locale={bootstrap.locale} messages={bootstrap.messages}>
        {/*
          Permissions are resolved on the server and passed down. The client
          never derives them from roles — a client-side decision is a display
          decision, and every one of these is also enforced server-side.
        */}
        <PermissionsProvider permissions={new Set(bootstrap.permissions)}>
          <ThemeProvider theme="base">
            <ServiceWorkerNotice />
            <Outlet />
          </ThemeProvider>
        </PermissionsProvider>
      </I18nProvider>
    </RootDocument>
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
