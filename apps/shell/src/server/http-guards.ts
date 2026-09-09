import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Same-origin check for state-changing server functions.
 *
 * TanStack server functions are same-origin `fetch` POSTs carrying
 * `SameSite=Lax` session cookies, which already blocks the classic cross-site
 * form POST. This is defence in depth for the mutating calls (`setLocale`,
 * and later `invokeAction` / `ingestAnalytics`): a request whose
 * `Sec-Fetch-Site` / `Origin` / `Referer` shows it did not come from this
 * site is refused before the handler runs. A full synchroniser-token scheme
 * is deliberately out of scope.
 */

export interface OriginHeaders {
  readonly secFetchSite?: string | null;
  readonly origin?: string | null;
  readonly referer?: string | null;
  /** The `Host` (or `X-Forwarded-Host`) the request was addressed to. */
  readonly host?: string | null;
}

/**
 * `true` when the request can be shown to originate from this site.
 *
 * - `Sec-Fetch-Site` is authoritative when present (every current browser
 *   sends it): only `same-origin` and `none` (a user-typed navigation or a
 *   bookmark) pass; `same-site` and `cross-site` do not.
 * - Otherwise the `Origin` (or, failing that, `Referer`) host is compared to
 *   the request `Host`.
 * - With none of those headers present the request cannot be shown to be
 *   same-origin, so a mutation is refused.
 */
export function isSameOrigin(headers: OriginHeaders): boolean {
  const site = headers.secFetchSite?.toLowerCase();
  if (site) return site === "same-origin" || site === "none";

  const stated = headers.origin ?? headers.referer;
  if (!stated || !headers.host) return false;

  try {
    return new URL(stated).host === headers.host;
  } catch {
    return false;
  }
}

/** Throws unless {@link isSameOrigin} holds for the current request. */
export function assertSameOrigin(): void {
  const ok = isSameOrigin({
    secFetchSite: getRequestHeader("sec-fetch-site"),
    origin: getRequestHeader("origin"),
    referer: getRequestHeader("referer"),
    host: getRequestHeader("x-forwarded-host") ?? getRequestHeader("host"),
  });
  if (!ok) {
    throw new Error("Cross-origin request refused.");
  }
}
