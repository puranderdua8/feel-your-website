import {
  type ContentAdapterError,
  type ContentWriter,
  type Locale,
} from "@feel-your-website/content-core";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapContentWriteError } from "./mapContentWriteError.js";

export interface SupabaseContentWriterOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. `has_permission('manage:content')`, enforced inside each RPC, is what actually protects writes. */
  anonKey: string;
  /**
   * Where the session lives across requests — the same contract
   * `SupabaseAuthProvider` and `SupabaseConfigBundleStore` take: the RPCs
   * check the *calling session's* permission, so this needs the session, not
   * a bare anon key.
   */
  cookies: CookieAdapter;
  /**
   * Overrides GoTrue's storage key, stable (`sb-<project-ref>-auth-token`) by
   * default — matching `SupabaseAuthProvider`'s own default for the same
   * reason: this instance's job is finding a session an earlier instance
   * wrote to cookies, which needs a *stable* key. A test holding two
   * *different* signed-in sessions in one process needs distinct keys to
   * avoid two GoTrueClients sharing one and both opening a same-named
   * `BroadcastChannel` (which, under Node, has been observed to throw).
   */
  storageKey?: string;
  /** Test seam: makes every call reject. */
  failWith?: ContentAdapterError;
}

/**
 * `ContentWriter` backed by Supabase Postgres — the `save_content_message` /
 * `delete_content_message` RPCs `..._content_writes.sql` defines.
 *
 * The counterpart to `SupabaseContentAdapter`, deliberately a separate class:
 * `SupabaseContentAdapter` reads with the anon key and no session at all,
 * while every method here runs as the signed-in caller and is refused by the
 * database without `manage:content`. Its whole surface is UI-chrome messages
 * now — route content is written through `SupabaseRouteCompositionWriter`.
 */
export class SupabaseContentWriter implements ContentWriter {
  readonly #client: SupabaseClient;
  readonly #failWith?: ContentAdapterError;

  constructor(options: SupabaseContentWriterOptions) {
    this.#failWith = options.failWith;
    this.#client = createServerClient(options.url, options.anonKey, {
      cookies: {
        getAll: async () => await options.cookies.getAll(),
        setAll: async (cookies, headers) => {
          await options.cookies.setAll(cookies, headers);
        },
      },
      ...(options.storageKey ? { auth: { storageKey: options.storageKey } } : {}),
    });
  }

  async saveMessage(locale: Locale, key: string, value: string): Promise<void> {
    this.#guard();

    const { error } = await this.#client.rpc("save_content_message", {
      p_locale: locale,
      p_key: key,
      p_value: value,
    });
    if (error) throw mapContentWriteError(error);
  }

  async deleteMessage(locale: Locale, key: string): Promise<void> {
    this.#guard();

    const { error } = await this.#client.rpc("delete_content_message", {
      p_locale: locale,
      p_key: key,
    });
    if (error) throw mapContentWriteError(error);
  }

  #guard(): void {
    if (this.#failWith) throw this.#failWith;
  }
}
