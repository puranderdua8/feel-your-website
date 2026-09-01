import { isContentAdapterError, type Content } from "@feel-your-website/content-core";
import { BOOTSTRAP_MESSAGES } from "@feel-your-website/i18n-core";
import { platformCatalog, resolvePermissions } from "@feel-your-website/rbac";
import { createServerFn } from "@tanstack/react-start";

import { isSupportedLocale, persistLocale, resolveLocale } from "@/i18n/strategy.server";

import { getAuthProvider, getContentAdapter } from "./adapters.js";

/**
 * The BFF.
 *
 * Everything the client needs goes through these server functions, and they
 * are the only code that touches an adapter. Going client→backend directly
 * would be less code and would hard-couple every screen to whichever backend
 * is in use, which is precisely what this platform is built to avoid.
 */

/**
 * The BFF never decides *how* the locale is determined — it asks the strategy.
 * That is what keeps switching between a cookie and a URL a change in one
 * place rather than across the server, the router and the UI.
 */

export interface BootstrapPayload {
  locale: string;
  messages: Record<string, string>;
  /** Resolved permission set, as an array for serialisation. */
  permissions: string[];
  /** Present only when signed in. */
  userId: string | null;
  /** True when messages came from the bootstrap set because the CMS failed. */
  degraded: boolean;
}

/**
 * Everything the shell needs to render its first frame: negotiated locale,
 * messages, and the resolved permission set.
 *
 * One call rather than three so the first paint is not gated on a waterfall.
 */
export const loadBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<BootstrapPayload> => {
    const locale = resolveLocale();

    const session = await getAuthProvider()
      .getSession()
      .catch(() => null);

    // Claims are only claims. They are resolved against the code catalog
    // before use, because a token can name a permission the code has since
    // removed — and granting one that no longer exists is the wrong
    // direction to fail in.
    const { permissions, unknown } = resolvePermissions(
      session
        ? [
            {
              id: "from-claims",
              name: "from-claims",
              permissions: session.permissions as never,
              createdAt: session.issuedAt,
              updatedAt: session.issuedAt,
            },
          ]
        : [],
      platformCatalog,
    );

    if (unknown.length > 0) {
      console.warn("[rbac] token carried unknown permissions:", unknown);
    }

    let messages: Record<string, string> = { ...BOOTSTRAP_MESSAGES };
    let degraded = false;

    try {
      const fromCms = await getContentAdapter().getMessages(locale);
      messages = { ...messages, ...fromCms };
    } catch (error) {
      // A CMS outage must degrade to the bootstrap set, not to a blank page.
      // This is the whole reason that set exists.
      degraded = true;
      console.error(
        "[cms] messages unavailable, serving bootstrap set:",
        isContentAdapterError(error) ? error.code : error,
      );
    }

    return {
      locale,
      messages,
      permissions: [...permissions],
      userId: session?.userId ?? null,
      degraded,
    };
  },
);

/**
 * Persists the user's language choice.
 *
 * Written server-side so the very next request — including a full reload or a
 * fresh visit tomorrow — is server-rendered in the chosen language. A purely
 * client-side write would leave the first paint in the old locale.
 */
export const setLocale = createServerFn({ method: "POST" })
  .validator((input: unknown): { locale: string } => {
    const locale =
      typeof input === "object" && input !== null && "locale" in input
        ? (input as { locale: unknown }).locale
        : null;

    // Validated rather than trusted: this value is persisted and echoed
    // into rendered pages.
    if (!isSupportedLocale(locale)) {
      throw new Error(`Unsupported locale: ${String(locale)}`);
    }
    return { locale };
  })
  .handler(async ({ data }): Promise<{ locale: string }> => {
    persistLocale(data.locale);
    return { locale: data.locale };
  });

export interface RoutePageItem {
  templateKey: string;
  content: Content | null;
}

export interface RoutePage {
  path: string;
  items: readonly RoutePageItem[];
}

/**
 * Resolves a request path against the published route manifest and fetches
 * each listed template's content, in order — the piece that turns a CMS
 * author publishing a route bundle into an actual page. See
 * `src/templates/registry.tsx` for what renders the result and
 * `src/routes/$.tsx` for the route that calls this.
 *
 * Returns `null` for a path with no published bundle, rather than throwing —
 * "this route doesn't exist" is exactly what `notFound()` is for at the
 * route layer, not a BFF-level error.
 */
export const loadRoutePage = createServerFn({ method: "GET" })
  .validator((input: unknown): { path: string } => {
    const path = (input as { path?: unknown })?.path;
    if (typeof path !== "string" || path.trim() === "") {
      throw new Error("path is required.");
    }
    return { path };
  })
  .handler(async ({ data }): Promise<RoutePage | null> => {
    const locale = resolveLocale();

    // `getRouteManifest` ignores its own locale argument (route structure is
    // shared across locales — see that method's own doc), so there is no
    // per-locale manifest to pick between; only the content fetched per item
    // below varies by locale.
    const manifest = await getContentAdapter().getRouteManifest(locale);
    const bundle = manifest.find((candidate) => candidate.path === data.path);
    if (!bundle) return null;

    const items = await Promise.all(
      bundle.items.map(async (templateKey): Promise<RoutePageItem> => ({
        templateKey,
        content: await getContentAdapter().getContent(templateKey, locale),
      })),
    );

    return { path: bundle.path, items };
  });

/** Resolves one template's content, honouring locale fallback. */
export const loadContent = createServerFn({ method: "GET" })
  .validator((input: unknown): { templateKey: string; locale: string } => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { templateKey?: unknown }).templateKey !== "string"
    ) {
      throw new Error("templateKey must be a non-empty string");
    }
    const { templateKey, locale } = input as {
      templateKey: string;
      locale?: unknown;
    };
    return {
      templateKey,
      locale: typeof locale === "string" ? locale : "",
    };
  })
  .handler(async ({ data }): Promise<Content | null> =>
    // An explicit locale is honoured (the CMS previews other languages that
    // way); otherwise the request's own locale applies, so a caller cannot
    // accidentally fetch English for a Hindi user by omitting it.
    getContentAdapter().getContent(data.templateKey, data.locale || resolveLocale()),
  );
