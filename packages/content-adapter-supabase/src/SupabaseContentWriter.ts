import {
  ContentAdapterError,
  type Content,
  type ContentWriter,
  type JsonValue,
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
   * wrote to cookies, which needs a *stable* key, not a random one.
   *
   * The one caller with a real reason to override it is a test holding two
   * *different* real, signed-in sessions alive in the same process at once
   * (see `writer.live.test.ts`) — ordinary request handling, one session per
   * request, never needs this. Two GoTrueClient instances sharing a storage
   * key also both open a same-named `BroadcastChannel` for cross-tab sync;
   * under Node two of those posting to each other has been observed to throw
   * (`TypeError: The "event" argument must be an instance of Event`, from
   * Node's own `BroadcastChannel`/`MessageEvent` interop), not just log
   * GoTrue's benign "multiple clients" warning — found by running exactly
   * that scenario against a live database.
   */
  storageKey?: string;
  /** Test seam: makes every call reject. */
  failWith?: ContentAdapterError;
}

/**
 * `ContentWriter` backed by Supabase Postgres — the `save_content_item` /
 * `delete_content_item` / `save_content_message` / `delete_content_message`
 * RPCs `..._content_writes.sql` defines.
 *
 * The counterpart to `SupabaseContentAdapter`, deliberately a separate class
 * rather than one class implementing both interfaces: `SupabaseContentAdapter`
 * reads with the anon key and no session at all (every table it queries is
 * public-read RLS), while every method here runs as the signed-in caller and
 * is refused by the database itself without `manage:content`. Two genuinely
 * different clients, not one client wearing two hats.
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

  async saveContentItem(
    templateKey: string,
    locale: Locale,
    fields: Readonly<Record<string, JsonValue>>,
    variant = "",
  ): Promise<Content> {
    this.#guard();

    const { data, error } = await this.#client.rpc("save_content_item", {
      p_template_key: templateKey,
      p_locale: locale,
      p_fields: fields,
      p_variant: variant,
    });
    if (error) throw mapContentWriteError(error);

    return {
      templateKey: data.template_key as string,
      variant: data.variant as string,
      locale: data.locale as string,
      translated: true,
      fields: data.fields as Record<string, JsonValue>,
      updatedAt: data.updated_at as string,
    };
  }

  async deleteContentItem(templateKey: string, locale: Locale, variant = ""): Promise<void> {
    this.#guard();

    const { error } = await this.#client.rpc("delete_content_item", {
      p_template_key: templateKey,
      p_locale: locale,
      p_variant: variant,
    });
    if (error) throw mapContentWriteError(error);
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
