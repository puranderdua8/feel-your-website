import {
  ConfigStoreError,
  InvalidItemsError,
  type ConfigBundle,
  type ConfigBundleStore,
  type ConfigBundleVersion,
  type CreateBundleInput,
  type UpdateBundleInput,
} from "@feel-your-website/config-schema";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CookieAdapter } from "./CookieAdapter.js";
import { mapConfigError } from "./mapConfigError.js";

/** A vocabulary is one instance of the substrate — see `config-schema`'s own doc. */
export type ConfigBundleVocabulary = "permission" | "template_key";

export interface SupabaseConfigBundleStoreOptions {
  /** The project URL — `SUPABASE_URL`. Safe to log; not secret. */
  url: string;
  /** The `anon` key. `has_permission()`, enforced inside each RPC, is what actually protects writes. */
  anonKey: string;
  /**
   * Where the session lives across requests — the same contract
   * `SupabaseAuthProvider` takes, and for the same reason: `save_role_bundle`
   * / `save_route_bundle` / `delete_config_bundle` check the *calling
   * session's* permissions via `auth.uid()`, so this store has to carry that
   * session, not merely an anon key.
   */
  cookies: CookieAdapter;
  /** Which vocabulary this store instance manages. One store per vocabulary, matching one RPC pair per vocabulary. */
  vocabulary: ConfigBundleVocabulary;
  /** Validates items against the fixed vocabulary. Returns the unknown ones. Same contract as `MemoryConfigBundleStore`. */
  findUnknownItems: (items: readonly string[]) => readonly string[];
  /** Items that must never be assignable through this store, even though they are valid vocabulary (e.g. `manage:roles`). */
  forbiddenItems?: readonly string[];
  /**
   * Scopes every name this store writes and lists to `` `${namespace}${name}` ``,
   * transparently stripped back off on read.
   *
   * Not a feature the CMS itself ever sets — `config_bundles` has a real
   * `unique (vocabulary, name)` constraint, shared across every caller of a
   * live database, so two isolated "empty" stores in the sense the
   * `ConfigBundleStore` contract means (see `live.test.ts`) still collide on
   * a bundle named "One" unless something tells them apart. The test file is
   * the only caller that sets this.
   */
  namespace?: string;
}

interface ConfigBundleRow {
  id: string;
  name: string;
  version: number;
  updated_at: string;
  updated_by: string;
}

/**
 * `ConfigBundleStore` backed by Supabase Postgres — the `save_role_bundle` /
 * `save_route_bundle` / `delete_config_bundle` RPCs `..._config_bundle_writes.sql`
 * defines, one instance per vocabulary.
 *
 * Every write and read runs as the signed-in caller, never the anon role:
 * `list`/`get`/`history` rely on the read policies in
 * `..._bundle_read_policies.sql` (a role author sees role bundles, a route
 * author sees route bundles, nobody sees both merely by holding one
 * permission), and every write relies on `has_permission()` inside the RPC.
 * There is deliberately no path around that check from here — this class has
 * no service-role mode.
 *
 * `actor` is part of `ConfigBundleStore`'s interface but is never sent
 * anywhere: the RPCs derive the writer from `auth.uid()` of the *session*,
 * not from a string a caller could claim. See `live.test.ts` for why this
 * store does not run the shared `runConfigBundleStoreContract` — that
 * contract asserts the caller's own `actor` string round-trips verbatim,
 * which no session-authenticated backend can honour without letting a client
 * forge who made a change.
 */
export class SupabaseConfigBundleStore<
  TItem extends string = string,
> implements ConfigBundleStore<TItem> {
  readonly #client: SupabaseClient;
  readonly #vocabulary: ConfigBundleVocabulary;
  readonly #findUnknownItems: (items: readonly string[]) => readonly string[];
  readonly #forbidden: ReadonlySet<string>;
  readonly #namespace: string;

  constructor(options: SupabaseConfigBundleStoreOptions) {
    this.#vocabulary = options.vocabulary;
    this.#findUnknownItems = options.findUnknownItems;
    this.#forbidden = new Set(options.forbiddenItems ?? []);
    this.#namespace = options.namespace ?? "";

    // Same construction as `SupabaseAuthProvider`, deliberately: this store's
    // RPCs are permission-checked against the calling session, so it needs
    // the session `@supabase/ssr` keeps in cookies, not a bare anon client.
    this.#client = createServerClient(options.url, options.anonKey, {
      cookies: {
        getAll: async () => await options.cookies.getAll(),
        setAll: async (cookies, headers) => {
          await options.cookies.setAll(cookies, headers);
        },
      },
    });
  }

  async list(): Promise<readonly ConfigBundle<TItem>[]> {
    let query = this.#client
      .from("config_bundles")
      .select("id, name, version, updated_at, updated_by")
      .eq("vocabulary", this.#vocabulary)
      .order("name");
    if (this.#namespace) query = query.like("name", `${this.#namespace}%`);

    const { data, error } = await query;
    if (error) throw mapConfigError(error);

    const rows = (data ?? []) as ConfigBundleRow[];
    if (rows.length === 0) return [];

    return this.#attachItems(rows);
  }

  async get(id: string): Promise<ConfigBundle<TItem> | null> {
    const { data, error } = await this.#client
      .from("config_bundles")
      .select("id, name, version, updated_at, updated_by")
      .eq("vocabulary", this.#vocabulary)
      .eq("id", id)
      .maybeSingle();
    if (error) throw mapConfigError(error);
    if (!data) return null;

    const [bundle] = await this.#attachItems([data as ConfigBundleRow]);
    return bundle ?? null;
  }

  async create(input: CreateBundleInput<TItem>, actor: string): Promise<ConfigBundle<TItem>> {
    void actor; // see the class doc — the real actor is the signed-in session.
    this.#validate(input.items);

    const name = `${this.#namespace}${input.name}`;

    if (this.#vocabulary === "permission") {
      const { data, error } = await this.#client.rpc("save_role_bundle", {
        p_name: name,
        p_items: [...input.items],
      });
      if (error) throw mapConfigError(error);
      return this.#toBundle(data as ConfigBundleRow, input.items);
    }

    if (!input.path) {
      throw new ConfigStoreError("invalid_items", "A route bundle needs a path.");
    }
    const { data, error } = await this.#client.rpc("save_route_bundle", {
      p_name: name,
      p_path: input.path,
      p_items: [...input.items],
      p_published: input.published ?? false,
    });
    if (error) throw mapConfigError(error);
    return this.#toBundle(
      data as ConfigBundleRow,
      input.items,
      input.path,
      input.published ?? false,
    );
  }

  async update(
    id: string,
    input: UpdateBundleInput<TItem>,
    expectedVersion: number,
    actor: string,
  ): Promise<ConfigBundle<TItem>> {
    void actor;

    const existing = await this.get(id);
    if (!existing) throw new ConfigStoreError("not_found", `No config bundle ${id}.`);

    const name = input.name ?? existing.name.slice(this.#namespace.length);
    const items = input.items ?? existing.items;
    this.#validate(items);

    const qualifiedName = `${this.#namespace}${name}`;

    if (this.#vocabulary === "permission") {
      const { data, error } = await this.#client.rpc("save_role_bundle", {
        p_name: qualifiedName,
        p_items: [...items],
        p_id: id,
        p_expected_version: expectedVersion,
      });
      if (error) throw mapConfigError(error, expectedVersion);
      return this.#toBundle(data as ConfigBundleRow, items);
    }

    const path = input.path ?? existing.path;
    const published = input.published ?? existing.published ?? false;
    if (!path) throw new ConfigStoreError("invalid_items", "A route bundle needs a path.");

    const { data, error } = await this.#client.rpc("save_route_bundle", {
      p_name: qualifiedName,
      p_path: path,
      p_items: [...items],
      p_published: published,
      p_id: id,
      p_expected_version: expectedVersion,
    });
    if (error) throw mapConfigError(error, expectedVersion);
    return this.#toBundle(data as ConfigBundleRow, items, path, published);
  }

  async delete(id: string, expectedVersion: number, actor: string): Promise<void> {
    void actor;

    const { error } = await this.#client.rpc("delete_config_bundle", {
      p_id: id,
      p_expected_version: expectedVersion,
    });
    if (error) throw mapConfigError(error, expectedVersion);
  }

  async history(id: string): Promise<readonly ConfigBundleVersion<TItem>[]> {
    const { data, error } = await this.#client
      .from("config_bundle_versions")
      .select("bundle_id, version, name, items, updated_at, updated_by, action")
      .eq("bundle_id", id)
      .order("version", { ascending: false });
    if (error) throw mapConfigError(error);

    return (data ?? []).map((row) => ({
      bundleId: row.bundle_id as string,
      version: row.version as number,
      name: (row.name as string).slice(this.#namespace.length),
      items: row.items as readonly TItem[],
      updatedAt: row.updated_at as string,
      updatedBy: row.updated_by as string,
      action: row.action as ConfigBundleVersion["action"],
    }));
  }

  /** Joins each header row against its vocabulary's item (and, for routes, path/published) satellite table. */
  async #attachItems(rows: ConfigBundleRow[]): Promise<ConfigBundle<TItem>[]> {
    const ids = rows.map((row) => row.id);

    if (this.#vocabulary === "permission") {
      const { data, error } = await this.#client
        .from("role_permissions")
        .select("bundle_id, permission")
        .in("bundle_id", ids);
      if (error) throw mapConfigError(error);

      const itemsByBundle = new Map<string, string[]>();
      for (const row of data ?? []) {
        const list = itemsByBundle.get(row.bundle_id as string) ?? [];
        list.push(row.permission as string);
        itemsByBundle.set(row.bundle_id as string, list);
      }
      // No ordinal on role_permissions — sorted for deterministic output,
      // matching the substrate's audience (a role editor's checkbox list),
      // where order carries no meaning the way route render order does.
      return rows.map((row) =>
        this.#toBundle(
          row,
          (itemsByBundle.get(row.id) ?? []).sort() as unknown as readonly TItem[],
        ),
      );
    }

    const [{ data: routeMeta, error: routeMetaError }, { data: templates, error: templatesError }] =
      await Promise.all([
        this.#client
          .from("route_bundles")
          .select("bundle_id, path, published")
          .in("bundle_id", ids),
        this.#client
          .from("route_templates")
          .select("bundle_id, ordinal, template_key")
          .in("bundle_id", ids)
          .order("ordinal"),
      ]);
    if (routeMetaError) throw mapConfigError(routeMetaError);
    if (templatesError) throw mapConfigError(templatesError);

    const metaByBundle = new Map((routeMeta ?? []).map((row) => [row.bundle_id as string, row]));
    const itemsByBundle = new Map<string, string[]>();
    for (const row of templates ?? []) {
      const list = itemsByBundle.get(row.bundle_id as string) ?? [];
      list.push(row.template_key as string);
      itemsByBundle.set(row.bundle_id as string, list);
    }

    return rows.map((row) => {
      const meta = metaByBundle.get(row.id);
      return this.#toBundle(
        row,
        (itemsByBundle.get(row.id) ?? []) as unknown as readonly TItem[],
        meta?.path as string | undefined,
        meta?.published as boolean | undefined,
      );
    });
  }

  #toBundle(
    row: ConfigBundleRow,
    items: readonly TItem[],
    path?: string,
    published?: boolean,
  ): ConfigBundle<TItem> {
    return {
      id: row.id,
      name: row.name.slice(this.#namespace.length),
      items,
      version: row.version,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      path,
      published,
    };
  }

  #validate(items: readonly string[]): void {
    const unknown = this.#findUnknownItems(items);
    const forbidden = items.filter((item) => this.#forbidden.has(item));
    const problems = [...new Set([...unknown, ...forbidden])].sort();
    if (problems.length > 0) throw new InvalidItemsError(problems);
  }
}
