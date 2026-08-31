import type { LocaleConfig } from "@feel-your-website/i18n-core";

/**
 * The locales this app serves.
 *
 * Adding one is a code change — it needs a build. The *content* for it is
 * authored in the CMS and needs no release.
 *
 * Strategy-independent: true whether locale lives in a cookie or the URL.
 */
export const localeConfig: LocaleConfig = {
  supported: ["en", "hi"],
  defaultLocale: "en",
};
