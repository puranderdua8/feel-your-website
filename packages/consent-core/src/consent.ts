/**
 * Analytics/marketing consent, framework-free.
 *
 * `unknown` — the visitor has not chosen; nothing non-essential may run yet.
 * `granted` / `denied` — an explicit choice, persisted.
 *
 * A browser Do-Not-Track or Global Privacy Control signal forces the effective
 * status to `denied` regardless of what is stored, and a granting action is
 * ignored while it is set.
 */
export type ConsentStatus = "unknown" | "granted" | "denied";

/** An explicit, persistable choice — the subset of {@link ConsentStatus} a user can pick. */
export type ConsentChoice = "granted" | "denied";

export const CONSENT_STORAGE_KEY = "fyw.consent";
export const CONSENT_COOKIE_NAME = "fyw_consent";

/** A year — long enough that a returning visitor is not re-asked constantly. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function normalize(value: string | null | undefined): ConsentStatus {
  return value === "granted" || value === "denied" ? value : "unknown";
}

function cookieValue(cookieString: string, name: string): string | null {
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

/**
 * `true` when the browser asks not to be tracked — DNT (`"1"` / `"yes"`) or
 * GPC (`navigator.globalPrivacyControl`). `navigator` is injectable for tests;
 * with none available (SSR) this is `false` and the stored choice stands.
 */
export function isPrivacySignalSet(nav?: Navigator): boolean {
  const n = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  if (!n) return false;

  const dntSources = [
    (n as { doNotTrack?: unknown }).doNotTrack,
    typeof window !== "undefined" ? (window as { doNotTrack?: unknown }).doNotTrack : undefined,
    (n as { msDoNotTrack?: unknown }).msDoNotTrack,
  ];
  if (dntSources.some((value) => value === "1" || value === "yes")) return true;

  return (n as { globalPrivacyControl?: unknown }).globalPrivacyControl === true;
}

/**
 * The persisted choice: `localStorage` first, then the cookie (which SSR also
 * reads). SSR-safe and defensive — a blocked `localStorage` or a private
 * window falls through to `"unknown"`, never throws.
 */
export function readStoredConsent(): ConsentStatus {
  if (typeof document === "undefined") return "unknown";

  try {
    const fromLocalStorage = normalize(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    if (fromLocalStorage !== "unknown") return fromLocalStorage;
  } catch {
    // localStorage unavailable (private mode, blocked) — try the cookie.
  }

  return normalize(cookieValue(document.cookie, CONSENT_COOKIE_NAME));
}

/**
 * The effective status: a set privacy signal forces `denied`; otherwise the
 * stored choice stands. Pure, so the provider and any SSR default-setter agree.
 */
export function resolveConsent(stored: ConsentStatus, privacySignalSet: boolean): ConsentStatus {
  return privacySignalSet ? "denied" : stored;
}

/** Persists a choice to `localStorage` and a `SameSite=Lax` cookie so the next SSR render matches. */
export function writeStoredConsent(choice: ConsentChoice): void {
  if (typeof document === "undefined") return;

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Non-fatal: the cookie below is the durable copy SSR needs anyway.
  }

  document.cookie = `${CONSENT_COOKIE_NAME}=${choice}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

/** Reads the consent choice from a raw `Cookie` header — for server-side Consent-Mode defaults. */
export function readConsentCookie(cookieHeader: string | null | undefined): ConsentStatus {
  return cookieHeader ? normalize(cookieValue(cookieHeader, CONSENT_COOKIE_NAME)) : "unknown";
}
