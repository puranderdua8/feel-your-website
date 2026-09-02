import {
  FALLBACK_SITE_LOCALES,
  type SiteLocale,
  type SiteSettingsStore,
} from "@feel-your-website/content-core";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapContentError } from "./mapContentError.js";
import { mapContentWriteError } from "./mapContentWriteError.js";

const LOCALES_KEY = "locales";

export interface SupabaseSiteSettingsStoreOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. `site_settings` is public-read; the write RPC checks `manage:content`. */
  anonKey: string;
  /**
   * Where the session lives across requests — `setLocales` runs the
   * `save_site_setting` RPC, which is permission-checked against the calling
   * session, so this needs the session, not a bare anon key.
   */
  cookies: CookieAdapter;
}

/**
 * `SiteSettingsStore` backed by Supabase — the `site_settings` table and the
 * `save_site_setting` RPC `..._site_settings.sql` defines.
 *
 * One client carrying the session: reads are public but there is no reason to
 * hold a second anon-only client just for them.
 */
export class SupabaseSiteSettingsStore implements SiteSettingsStore {
  readonly #client: SupabaseClient;

  constructor(options: SupabaseSiteSettingsStoreOptions) {
    this.#client = createServerClient(options.url, options.anonKey, {
      cookies: {
        getAll: async () => await options.cookies.getAll(),
        setAll: async (cookies, headers) => {
          await options.cookies.setAll(cookies, headers);
        },
      },
    });
  }

  async getLocales(): Promise<readonly SiteLocale[]> {
    const { data, error } = await this.#client
      .from("site_settings")
      .select("value")
      .eq("key", LOCALES_KEY)
      .maybeSingle();
    if (error) throw mapContentError(error);

    const value = data?.value;
    if (!Array.isArray(value) || value.length === 0) return FALLBACK_SITE_LOCALES;

    return value
      .filter(
        (entry): entry is SiteLocale =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as SiteLocale).locale === "string" &&
          typeof (entry as SiteLocale).label === "string",
      )
      .map((entry) => ({ locale: entry.locale, label: entry.label }));
  }

  async setLocales(locales: readonly SiteLocale[]): Promise<void> {
    const { error } = await this.#client.rpc("save_site_setting", {
      p_key: LOCALES_KEY,
      p_value: locales,
    });
    if (error) throw mapContentWriteError(error);
  }
}
