/**
 * Site-wide settings the CMS authors and every surface reads — starting with
 * the set of content locales.
 *
 * Kept out of the `config_bundles` substrate for the same reason content is:
 * this is a single small key→value bag, not a versioned, audited bundle drawn
 * from a fixed vocabulary. It also is not `Content` — no template key, no
 * locale of its own — so it earns its own narrow store rather than a place in
 * `ContentAdapter`.
 */

/** One configured content language: its BCP-47 tag and a human label. */
export interface SiteLocale {
  readonly locale: string;
  /** Shown in the language switcher, e.g. `"English"`, `"हिन्दी"`. */
  readonly label: string;
}

export interface SiteSettingsStore {
  /**
   * The configured content locales, first one being the default. Never
   * empty — an implementation with nothing stored returns a one-entry
   * fallback so a switcher always has something to show.
   */
  getLocales(): Promise<readonly SiteLocale[]>;

  /** Replaces the configured locale set wholesale. */
  setLocales(locales: readonly SiteLocale[]): Promise<void>;
}

/** The fallback returned when nothing is configured yet. */
export const FALLBACK_SITE_LOCALES: readonly SiteLocale[] = [{ locale: "en", label: "English" }];

/**
 * In-memory {@link SiteSettingsStore} — the CMS's local-dev store, and the
 * first implementation of the contract.
 */
export class MemorySiteSettingsStore implements SiteSettingsStore {
  #locales: readonly SiteLocale[];

  constructor(seed: readonly SiteLocale[] = FALLBACK_SITE_LOCALES) {
    this.#locales = seed.length > 0 ? [...seed] : FALLBACK_SITE_LOCALES;
  }

  async getLocales(): Promise<readonly SiteLocale[]> {
    return this.#locales;
  }

  async setLocales(locales: readonly SiteLocale[]): Promise<void> {
    this.#locales = locales.length > 0 ? [...locales] : FALLBACK_SITE_LOCALES;
  }
}
