import { readLocaleCookie } from "@feel-your-website/i18n-core";

import { localeConfig } from "@/i18n/config.js";

/**
 * The visitor's locale, read directly from the browser cookie rather than
 * asked of the server — the one piece every offline fallback needs
 * (`cms-route.tsx`'s `cmsLoader`, `__root.tsx`'s root loader) and, by
 * definition, can't get from `resolveLocale()` (server-only, and offline
 * means there is no server to reach). Same cookie, so a visitor who has
 * picked a language still sees it offline; the default locale otherwise.
 */
export function readOfflineLocale(): string {
  const cookie = readLocaleCookie();
  return cookie && localeConfig.supported.includes(cookie) ? cookie : localeConfig.defaultLocale;
}
