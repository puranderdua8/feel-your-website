import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { setLocale } from "@/server/bff";

/**
 * ── LOCALE STRATEGY: UI half ────────────────────────────────────────────────
 *
 * Paired with `strategy.server.ts`. See that file for the full note on
 * swapping strategies.
 *
 * ACTIVE STRATEGY: **cookie**.
 *
 * Named `.ui.` rather than `.client.` deliberately: `*.client.*` is a
 * reserved TanStack Start pattern that is denied in the server bundle, and
 * this module is not browser-only — `routerLocaleOptions` is read while
 * building the router on both sides, and the hook renders during SSR.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Router options this strategy needs.
 *
 * Empty for the cookie strategy: locale is not in the address, so the router
 * needs no rewriting and no per-locale routes.
 *
 * The URL strategy would return a `rewrite` pair here — `input` stripping the
 * locale segment so one route tree serves every language, `output` restoring
 * it so links stay shareable. Exposed as options rather than written inline
 * in `router.tsx` so the router file itself never has to change.
 */
export const routerLocaleOptions = {} as const;

/**
 * Returns a function that switches the interface language.
 *
 * For the cookie strategy that is a server round-trip (so the cookie is set
 * authoritatively) followed by `router.invalidate()`, which refetches every
 * loader. All CMS copy therefore arrives in the new language together —
 * nothing is translated client-side, so a partial update would leave two
 * languages on screen at once, which the product forbids.
 *
 * The URL strategy would instead navigate to the localised path; the calling
 * component does not change either way.
 */
export function useLocaleSwitch(): (locale: string) => Promise<void> {
  const router = useRouter();

  return useCallback(
    async (locale: string) => {
      await setLocale({ data: { locale } });
      await router.invalidate();
    },
    [router],
  );
}
