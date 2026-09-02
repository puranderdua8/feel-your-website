import { MockAuthProvider, type AuthProvider } from "@feel-your-website/auth";
import { SupabaseAuthProvider, type CookieAdapter } from "@feel-your-website/auth-supabase";
import {
  SupabaseConfigBundleStore,
  type ConfigBundleVocabulary,
} from "@feel-your-website/config-bundle-supabase";
import { MemoryConfigBundleStore, type ConfigBundleStore } from "@feel-your-website/config-schema";
import { contractSeed, MemoryContentAdapter } from "@feel-your-website/content-adapter-memory";
import {
  SupabaseContentAdapter,
  SupabaseContentWriter,
  SupabaseSiteSettingsStore,
} from "@feel-your-website/content-adapter-supabase";
import type {
  ContentAdapter,
  ContentWriter,
  SiteLocale,
  SiteSettingsStore,
} from "@feel-your-website/content-core";
import { findUnknownTemplateKeys, MemorySiteSettingsStore } from "@feel-your-website/content-core";
import { platformCatalog, SEED_ONLY_PERMISSIONS } from "@feel-your-website/rbac";
import { getCookies, setCookie, setResponseHeader } from "@tanstack/react-start/server";

import { templateCatalog } from "../content/template-keys.js";

/**
 * The dependency-injection point — same role as `apps/shell/src/server/adapters.ts`,
 * and the same rule: this is the only module in the app that names a concrete
 * backend. See that file's own doc for why `seam.test.ts` is what makes that
 * a checked property rather than a convention someone can quietly break.
 */

export type ContentAdapterKind = "memory" | "supabase";
export type AuthProviderKind = "mock" | "supabase";

function resolveContentAdapterKind(): ContentAdapterKind {
  const configured = process.env.CONTENT_ADAPTER ?? "memory";
  if (configured === "memory" || configured === "supabase") return configured;

  throw new Error(`Unknown CONTENT_ADAPTER "${configured}". Expected "memory" or "supabase".`);
}

function resolveAuthProviderKind(): AuthProviderKind {
  const configured = process.env.AUTH_PROVIDER ?? "mock";
  if (configured === "mock" || configured === "supabase") return configured;

  throw new Error(`Unknown AUTH_PROVIDER "${configured}". Expected "mock" or "supabase".`);
}

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when using the Supabase adapter. Check your .env.`);
  }
  return value;
}

/**
 * Same construction as `apps/shell`'s copy of this function, kept here for
 * the identical reason `seam.test.ts` exists to enforce: it names a concrete
 * `@supabase/ssr` cookie shape, so it has to live in the one file allowed to.
 * Structurally identical across `auth-supabase`, `config-bundle-supabase` and
 * `content-adapter-supabase` — see each package's own `CookieAdapter.ts` note
 * on why the type is declared three times rather than shared.
 */
function tanstackCookieAdapter(): CookieAdapter {
  return {
    getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
    setAll: (cookies, headers) => {
      for (const { name, value, options } of cookies) {
        setCookie(name, value, options);
      }
      for (const [key, value] of Object.entries(headers)) {
        setResponseHeader(key, value);
      }
    },
  };
}

/** Local-dev content locales — kept in step with `supabase/seed`'s intent. */
const DEV_SITE_LOCALES: readonly SiteLocale[] = [
  { locale: "en", label: "English" },
  { locale: "hi", label: "हिन्दी" },
];

let contentAdapter: ContentAdapter | null = null;
let contentWriter: ContentWriter | null = null;
let authProvider: AuthProvider | null = null;
let siteSettingsStore: SiteSettingsStore | null = null;
const configBundleStores = new Map<ConfigBundleVocabulary, ConfigBundleStore>();

export function getContentAdapter(): ContentAdapter {
  if (contentAdapter) return contentAdapter;

  const kind = resolveContentAdapterKind();
  if (kind === "supabase") {
    contentAdapter = new SupabaseContentAdapter({
      url: requireEnv("SUPABASE_URL"),
      anonKey: requireEnv("SUPABASE_ANON_KEY"),
      defaultLocale: "en",
    });
  } else {
    // Shared with getContentWriter() below: MemoryContentAdapter implements
    // both interfaces over the same mutable seed, so a save here is visible
    // to the very next read in local dev — see that class's own note on why
    // it is one class, unlike the Supabase pair.
    contentAdapter = memoryContent();
  }

  return contentAdapter;
}

export function getContentWriter(): ContentWriter {
  if (contentWriter) return contentWriter;

  const kind = resolveContentAdapterKind();
  contentWriter =
    kind === "supabase"
      ? new SupabaseContentWriter({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
          cookies: tanstackCookieAdapter(),
        })
      : memoryContent();

  return contentWriter;
}

function memoryContent(): MemoryContentAdapter {
  const shared =
    contentAdapter instanceof MemoryContentAdapter
      ? contentAdapter
      : new MemoryContentAdapter(contractSeed);
  contentAdapter = shared;
  return shared;
}

export function getSiteSettingsStore(): SiteSettingsStore {
  if (siteSettingsStore) return siteSettingsStore;

  const kind = resolveContentAdapterKind();
  siteSettingsStore =
    kind === "supabase"
      ? new SupabaseSiteSettingsStore({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
          cookies: tanstackCookieAdapter(),
        })
      : new MemorySiteSettingsStore(DEV_SITE_LOCALES);

  return siteSettingsStore;
}

export function getAuthProvider(): AuthProvider {
  if (authProvider) return authProvider;

  const kind = resolveAuthProviderKind();
  authProvider =
    kind === "supabase"
      ? new SupabaseAuthProvider({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
          cookies: tanstackCookieAdapter(),
        })
      : new MockAuthProvider({
          accounts: [
            {
              userId: "user-editor",
              email: "editor@example.com",
              password: "demo",
              permissions: ["manage:content", "manage:roles", "manage:routes", "view:audit"],
            },
          ],
        });

  return authProvider;
}

/**
 * One store per vocabulary — `"permission"` for the role editor, `"template_key"`
 * for the route bundle editor.
 *
 * Deliberately keyed off `AUTH_PROVIDER`, not a config-bundle-specific env
 * var: a config bundle write is only ever meaningful against a *real* signed-in
 * session (`has_permission()` reads the session's own JWT claims), so a
 * mock-auth session — which carries no such claims to begin with — gets the
 * in-memory store, matching what it can actually exercise, while a Supabase
 * session gets the real one sharing that same session's cookies.
 */
export function getConfigBundleStore(vocabulary: ConfigBundleVocabulary): ConfigBundleStore {
  const cached = configBundleStores.get(vocabulary);
  if (cached) return cached;

  const kind = resolveAuthProviderKind();
  const store =
    kind === "supabase"
      ? new SupabaseConfigBundleStore({
          url: requireEnv("SUPABASE_URL"),
          anonKey: requireEnv("SUPABASE_ANON_KEY"),
          cookies: tanstackCookieAdapter(),
          vocabulary,
          ...vocabularyValidation(vocabulary),
        })
      : new MemoryConfigBundleStore(vocabularyValidation(vocabulary));

  configBundleStores.set(vocabulary, store);
  return store;
}

function vocabularyValidation(vocabulary: ConfigBundleVocabulary): {
  findUnknownItems: (items: readonly string[]) => readonly string[];
  forbiddenItems?: readonly string[];
} {
  return vocabulary === "permission"
    ? {
        findUnknownItems: (items) => items.filter((item) => !platformCatalog.includes(item)),
        forbiddenItems: SEED_ONLY_PERMISSIONS,
      }
    : { findUnknownItems: (items) => findUnknownTemplateKeys(templateCatalog, items) };
}

/** Test seam: forces the next call to rebuild from current env. */
export function resetAdapters(): void {
  contentAdapter = null;
  contentWriter = null;
  authProvider = null;
  siteSettingsStore = null;
  configBundleStores.clear();
}
