import type { SiteLocale } from "@feel-your-website/content-core";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * The CMS chrome stays English (this app has no `i18n-core` dependency —
 * see `src/router.tsx`). What *is* switchable is the **content** locale: the
 * language whose copy every authoring surface reads and writes.
 *
 * The locale set comes from the `SiteSettingsStore` via the route loader
 * (`listSiteLocales`); {@link DEFAULT_SITE_LOCALES} is only the fallback when
 * that fetch yields nothing. Selection is client-only for now — no cookie, no
 * round trip.
 */
export type { SiteLocale };

export const DEFAULT_SITE_LOCALES: readonly SiteLocale[] = [{ locale: "en", label: "English" }];

interface ContentLocaleValue {
  readonly locales: readonly SiteLocale[];
  readonly contentLocale: string;
  readonly setContentLocale: (locale: string) => void;
}

const ContentLocaleContext = createContext<ContentLocaleValue | null>(null);

export function ContentLocaleProvider({
  locales = DEFAULT_SITE_LOCALES,
  children,
}: {
  locales?: readonly SiteLocale[];
  children: ReactNode;
}) {
  const [contentLocale, setContentLocale] = useState(locales[0]?.locale ?? "en");

  const value = useMemo<ContentLocaleValue>(
    () => ({ locales, contentLocale, setContentLocale }),
    [locales, contentLocale],
  );

  return <ContentLocaleContext.Provider value={value}>{children}</ContentLocaleContext.Provider>;
}

export function useContentLocale(): ContentLocaleValue {
  const ctx = useContext(ContentLocaleContext);
  if (!ctx) throw new Error("useContentLocale() must be used within a <ContentLocaleProvider>");
  return ctx;
}
