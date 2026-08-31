import { ThemeProvider } from "@puranderdua8/theme/client";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "feel-your-website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <RootDocument>
      {/*
        The app-wide default theme. ThemeProvider scopes its CSS custom
        properties to a wrapper element via `data-theme` rather than swapping a
        global stylesheet, so routes can nest a second provider and render a
        different theme side by side — which is what the proving page does.
      */}
      <ThemeProvider theme="base">
        <Outlet />
      </ThemeProvider>
    </RootDocument>
  );
}

function NotFound() {
  // Placeholder copy. A later phase replaces this with CMS-served text and an
  // i18n bootstrap bundle; no user-facing copy stays hard-coded past that.
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">No route here.</p>
    </main>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
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
