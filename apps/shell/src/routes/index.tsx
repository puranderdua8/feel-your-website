import { useTranslations } from "@feel-your-website/i18n-core/react";
import { Badge } from "@feel-your-website/ui";
import { ThemeProvider } from "@feel-your-website/theme/client";
import { createFileRoute, Link } from "@tanstack/react-router";

import { LanguageSwitcher } from "@/components/language-switcher";
import { RoutePageView, seoToHead } from "@/components/route-page";
import { localeConfig } from "@/i18n/config";
import { loadRoutePage, type RoutePage } from "@/server/bff";

import { ThemeShowcase } from "@/components/theme-showcase";
import { Route as RootRoute } from "./__root";

/**
 * The home page delegates to the route matcher: if a CMS route is published at
 * `/`, it renders that; otherwise it falls back to the built-in showcase below.
 * `/` is not a reserved path (see `reserved-paths.ts`) precisely so it can be
 * authored.
 */
export const Route = createFileRoute("/")({
  loader: async (): Promise<RoutePage | null> => loadRoutePage({ data: { path: "/" } }),
  head: ({ loaderData }) => (loaderData ? seoToHead(loaderData) : {}),
  component: Home,
});

const THEMES = ["base", "corporate", "playful"] as const;

function Home() {
  const t = useTranslations();
  const bootstrap = RootRoute.useLoaderData();
  const page = Route.useLoaderData();

  // A CMS-authored `/` wins; the showcase below is the fallback.
  if (page) return <RoutePageView page={page} />;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">feel-your-website</h1>
        <p className="text-muted-foreground text-sm">
          Phase 3 — the shell, running against the memory adapter.
        </p>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge>{bootstrap.locale}</Badge>
          {/*
            `degraded` is true when the CMS could not be reached and the
            bootstrap set is doing the talking. Surfaced rather than hidden:
            silently serving fallback copy makes a CMS outage invisible.
          */}
          {bootstrap.degraded ? (
            <Badge variant="destructive">{t("bootstrap.offline.title")}</Badge>
          ) : (
            <Badge variant="secondary">CMS connected</Badge>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground font-mono text-xs uppercase">
          Copy served from the CMS
        </h2>
        <ul className="flex flex-col gap-1 text-sm">
          {/*
            None of this text is in the app. It is fetched per request and
            layered over the bootstrap set.
          */}
          <li>{t("bootstrap.loading")}</li>
          <li>{t("bootstrap.offline.body")}</li>
          <li>{t("bootstrap.retry")}</li>
        </ul>
      </section>

      <section className="flex flex-wrap gap-4 text-sm">
        <Link to="/admin" className="underline">
          Permission-gated route →
        </Link>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground font-mono text-xs uppercase">Language</h2>
        <LanguageSwitcher locales={localeConfig.supported} active={bootstrap.locale} />
        <p className="text-muted-foreground text-xs">
          Stored in a cookie, so it survives closing the app — and the next visit is server-rendered
          in this language.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-muted-foreground font-mono text-xs uppercase">Theming contract</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {THEMES.map((theme) => (
            <ThemeProvider key={theme} theme={theme}>
              <ThemeShowcase />
            </ThemeProvider>
          ))}
        </div>
      </section>
    </main>
  );
}
