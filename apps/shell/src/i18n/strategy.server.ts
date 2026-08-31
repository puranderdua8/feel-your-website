import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_OPTIONS,
  negotiateLocale,
} from "@feel-your-website/i18n-core";
import { getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

import { localeConfig } from "./config.js";

/**
 * ── LOCALE STRATEGY: server half ────────────────────────────────────────────
 *
 * Everything about *where the locale comes from* and *how a choice is
 * persisted* lives here and in `strategy.client.ts`. Nothing else in the app
 * knows the mechanism — the BFF asks for a locale, the switcher asks to
 * change it, and neither cares how.
 *
 * ACTIVE STRATEGY: **cookie**. Locale is a per-user preference, absent from
 * the URL.
 *
 * To switch to URL-based locale (shareable per-language links), only these
 * two strategy files change:
 *
 *   1. Here: pass `pathname` to `negotiateLocale` — it already accepts one —
 *      and make `persistLocale` a no-op, since the URL carries the choice.
 *      Note that a server function cannot read the original path (it sees
 *      `/_serverFn/…` from the client and the rewritten path during SSR), so
 *      the path must be handed in by the caller.
 *   2. `strategy.client.ts`: return the router's rewrite options, and make
 *      switching a navigation rather than a server call.
 *
 * The `i18n-core` primitives for both strategies (`extractLocaleFromPath`,
 * `localizePath`, and `negotiateLocale`'s URL source) already exist, so no
 * package changes are needed either way.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * The locale for the current request.
 *
 * NOT exported beyond the server: it reads server-only request APIs, and a
 * plain export would drag them into the client bundle through any module that
 * also exports a server function.
 *
 * Order is `cookie → Accept-Language → default`. The cookie is a decision the
 * user made; `Accept-Language` is only the browser's guess, used to pick a
 * sensible language on a first visit.
 */
export function resolveLocale(): string {
  return negotiateLocale(localeConfig, {
    cookie: getCookie(LOCALE_COOKIE) ?? null,
    acceptLanguage: getRequestHeader("accept-language") ?? null,
  });
}

/**
 * Persists a chosen locale.
 *
 * Written server-side so the very next request — a reload, or a visit
 * tomorrow — is server-rendered in the chosen language. A client-only write
 * would leave the first paint in the old locale.
 */
export function persistLocale(locale: string): void {
  setCookie(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);
}

/** Whether a locale is one this app serves. Guards anything written or echoed. */
export function isSupportedLocale(locale: unknown): locale is string {
  return typeof locale === "string" && localeConfig.supported.includes(locale);
}
