/**
 * The persisted locale choice lives in a cookie, not in localStorage.
 *
 * This is a correctness constraint, not a preference. The server renders the
 * first frame and must know the locale at request time. `localStorage` does
 * not exist on the server, so a choice stored only there would mean the
 * server always renders the default, the client corrects it after hydration,
 * and the user sees a flash of English before their actual language — along
 * with a hydration mismatch. A cookie is sent with every request, so the very
 * first byte of HTML is already in the right language.
 *
 * It rides on every server-function call too, which is what makes the BFF
 * locale-aware without threading a parameter through each one.
 */

/** Cookie name the persisted locale choice is stored under. */
export const LOCALE_COOKIE = "locale";

/** One year. The choice should outlive the browser being closed. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Attributes every write must use.
 *
 * Deliberately **not** `httpOnly`: the client reads this to render the
 * switcher's current state, and there is nothing sensitive about a language
 * preference. `SameSite=Lax` still keeps it off cross-site requests.
 */
export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: LOCALE_COOKIE_MAX_AGE,
  sameSite: "lax",
} as const;

/**
 * Reads the persisted locale in the browser.
 *
 * Returns null on the server, where the cookie arrives on the request instead
 * and should be read from there.
 */
export function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;

  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === LOCALE_COOKIE) {
      return decodeURIComponent(rest.join("=")) || null;
    }
  }
  return null;
}

/**
 * Serialises the cookie header value for a locale.
 *
 * Shared by the server (which sets it authoritatively) and any client-side
 * write, so the attributes cannot drift between the two paths — a mismatch in
 * `path` alone would silently create two cookies and make the choice look
 * like it failed to save.
 */
export function serializeLocaleCookie(locale: string): string {
  const { path, maxAge, sameSite } = LOCALE_COOKIE_OPTIONS;
  return [
    `${LOCALE_COOKIE}=${encodeURIComponent(locale)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite === "lax" ? "Lax" : sameSite}`,
  ].join("; ");
}
