/**
 * Locale negotiation and URL handling.
 *
 * Hand-rolled rather than taken from a library because the only thing a
 * library would add here is message compilation — and this platform serves
 * every message from the CMS, so there is nothing to compile. What remains is
 * about a hundred lines of negotiation and path handling, which is cheaper to
 * own than to configure around.
 */

export interface LocaleConfig {
  /** Locales this app serves, most preferred first. */
  readonly supported: readonly string[];
  /** Served when negotiation finds nothing better. */
  readonly defaultLocale: string;
  /**
   * When true, the default locale has no URL prefix: `/help` rather than
   * `/en/help`. Keeps the common case's URLs clean.
   */
  readonly prefixDefaultLocale?: boolean;
}

export interface LocaleSources {
  /**
   * Request path, e.g. `/hi/help`.
   *
   * Supported because a cloned project may want shareable per-locale URLs,
   * but the shell deliberately does not use it: locale is a per-user
   * preference carried in a cookie, not part of the address. Left in place
   * rather than removed so the capability is available without re-deriving
   * the negotiation logic.
   */
  pathname?: string;
  /** Persisted choice. Beats the browser's guess. */
  cookie?: string | null;
  /** The browser's `Accept-Language` header. */
  acceptLanguage?: string | null;
}

/**
 * Resolves the locale to serve.
 *
 * Order is `url → cookie → Accept-Language → default`, and the reasoning is
 * about intent: a locale in the URL is a deliberate, shareable request; a
 * cookie is a remembered decision; `Accept-Language` is only ever a guess.
 */
export function negotiateLocale(config: LocaleConfig, sources: LocaleSources): string {
  const fromPath = sources.pathname ? extractLocaleFromPath(sources.pathname, config).locale : null;
  if (fromPath) return fromPath;

  if (sources.cookie && isSupported(config, sources.cookie)) {
    return sources.cookie;
  }

  const fromHeader = matchAcceptLanguage(config, sources.acceptLanguage);
  if (fromHeader) return fromHeader;

  return config.defaultLocale;
}

function isSupported(config: LocaleConfig, locale: string): boolean {
  return config.supported.includes(locale);
}

/**
 * Picks the best supported locale from an `Accept-Language` header.
 *
 * Honours q-values, and falls back from a region to its base language so a
 * browser asking for `en-IN` is served `en` rather than dropping to the
 * default — the region is a refinement, not a different language.
 */
export function matchAcceptLanguage(
  config: LocaleConfig,
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    if (tag === "*") return config.defaultLocale;
    if (isSupported(config, tag)) return tag;

    const base = tag.split("-")[0];
    if (base && isSupported(config, base)) return base;
  }

  return null;
}

export interface ExtractedLocale {
  /** The locale found in the path, or null if the path carries none. */
  locale: string | null;
  /** The path with any locale segment removed, always starting with `/`. */
  pathname: string;
}

/** Splits a locale prefix off a path: `/hi/help` → `{ locale: "hi", pathname: "/help" }`. */
export function extractLocaleFromPath(pathname: string, config: LocaleConfig): ExtractedLocale {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (first && isSupported(config, first)) {
    const rest = segments.slice(1).join("/");
    return { locale: first, pathname: `/${rest}` };
  }

  return { locale: null, pathname: normalise(pathname) };
}

/** Adds the locale prefix a path should carry. Inverse of {@link extractLocaleFromPath}. */
export function localizePath(pathname: string, locale: string, config: LocaleConfig): string {
  const { pathname: bare } = extractLocaleFromPath(pathname, config);

  const needsPrefix = locale !== config.defaultLocale || config.prefixDefaultLocale === true;

  if (!needsPrefix) return bare;

  return bare === "/" ? `/${locale}` : `/${locale}${bare}`;
}

/** Removes any locale prefix. */
export function deLocalizePath(pathname: string, config: LocaleConfig): string {
  return extractLocaleFromPath(pathname, config).pathname;
}

function normalise(pathname: string): string {
  if (!pathname.startsWith("/")) return `/${pathname}`;
  return pathname;
}
