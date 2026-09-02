import type {
  ConfigBundle,
  ConfigBundleVersion,
  CreateBundleInput,
  UpdateBundleInput,
} from "@feel-your-website/config-schema";
import type {
  JsonValue,
  RouteBundle,
  RouteComposition,
  RouteCompositionSummary,
  RouteSectionNode,
  RouteSeo,
  SiteLocale,
} from "@feel-your-website/content-core";
import {
  findUnknownSectionRefs,
  flattenNodes,
  flattenTree,
  validateSectionFields,
} from "@feel-your-website/content-core";
import { platformCatalog, resolvePermissions } from "@feel-your-website/rbac";
import { sectionCatalog } from "@feel-your-website/section-registry";
import { createServerFn } from "@tanstack/react-start";

import {
  getAuthProvider,
  getConfigBundleStore,
  getContentAdapter,
  getContentWriter,
  getRouteCompositionReader,
  getRouteCompositionWriter,
  getSiteSettingsStore,
} from "./adapters.js";

/**
 * The BFF — same role as `apps/shell/src/server/bff.ts`: the only code that
 * touches an adapter besides `adapters.ts` itself. Every route calls one of
 * these, never an adapter directly.
 */

export interface SessionPayload {
  userId: string | null;
  email: string | null;
  permissions: string[];
}

export const loadSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionPayload> => {
    const session = await getAuthProvider()
      .getSession()
      .catch(() => null);

    if (!session) return { userId: null, email: null, permissions: [] };

    // Same reasoning as apps/shell's loadBootstrap: claims are resolved
    // against the code catalog before use, never trusted verbatim.
    const { permissions, unknown } = resolvePermissions(
      [
        {
          id: "from-claims",
          name: "from-claims",
          permissions: session.permissions as never,
          createdAt: session.issuedAt,
          updatedAt: session.issuedAt,
        },
      ],
      platformCatalog,
    );
    if (unknown.length > 0) {
      console.warn("[rbac] token carried unknown permissions:", unknown);
    }

    return { userId: session.userId, email: session.email ?? null, permissions: [...permissions] };
  },
);

export const signIn = createServerFn({ method: "POST" })
  .validator((input: unknown): { email: string; password: string } => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { email?: unknown }).email !== "string" ||
      typeof (input as { password?: unknown }).password !== "string"
    ) {
      throw new Error("email and password are required.");
    }
    return input as { email: string; password: string };
  })
  .handler(async ({ data }): Promise<SessionPayload> => {
    const session = await getAuthProvider().signIn({
      kind: "password",
      email: data.email,
      password: data.password,
    });
    return {
      userId: session.userId,
      email: session.email ?? null,
      permissions: [...session.permissions],
    };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async (): Promise<void> => {
  await getAuthProvider().signOut();
});

// --- Content -----------------------------------------------------------

// Section content is no longer a thing the CMS reads or writes on its own:
// it lives on each route section instance (see `saveRouteComposition` below),
// so there is no `saveContentItem` / `getSectionContent` here any more. The
// `content_items` table and `ContentWriter`'s item methods are dead code the
// B6 cleanup removes.

/**
 * The configured content locales — what the header language switcher, the
 * Languages tab and the publish-completeness gate all iterate.
 */
export const listSiteLocales = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly SiteLocale[]> => getSiteSettingsStore().getLocales(),
);

/** Replaces the configured content-locale set. `manage:content` gated in the store. */
export const saveSiteLocales = createServerFn({ method: "POST" })
  .validator((input: unknown): { locales: SiteLocale[] } => {
    const raw = (input as { locales?: unknown } | undefined)?.locales;
    if (!Array.isArray(raw)) throw new Error("locales must be an array.");
    const locales = raw.map((entry): SiteLocale => {
      const { locale, label } = (entry ?? {}) as Record<string, unknown>;
      if (typeof locale !== "string" || locale.trim() === "") {
        throw new Error("every locale needs a non-empty BCP-47 tag.");
      }
      return { locale: locale.trim(), label: typeof label === "string" ? label : locale.trim() };
    });
    if (locales.length === 0) throw new Error("at least one locale is required.");
    return { locales };
  })
  .handler(async ({ data }): Promise<readonly SiteLocale[]> => {
    await getSiteSettingsStore().setLocales(data.locales);
    return getSiteSettingsStore().getLocales();
  });

export const listMessages = createServerFn({ method: "GET" })
  .validator((input: unknown): { locale: string } => {
    const locale = (input as { locale?: unknown })?.locale;
    if (typeof locale !== "string" || locale.trim() === "") throw new Error("locale is required.");
    return { locale };
  })
  .handler(async ({ data }): Promise<Readonly<Record<string, string>>> =>
    getContentAdapter().getMessages(data.locale),
  );

export const saveMessage = createServerFn({ method: "POST" })
  .validator((input: unknown): { locale: string; key: string; value: string } => {
    const { locale, key, value } = (input ?? {}) as Record<string, unknown>;
    if (typeof locale !== "string" || typeof key !== "string" || typeof value !== "string") {
      throw new Error("locale, key and value are required.");
    }
    return { locale, key, value };
  })
  .handler(async ({ data }): Promise<void> => {
    await getContentWriter().saveMessage(data.locale, data.key, data.value);
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .validator((input: unknown): { locale: string; key: string } => {
    const { locale, key } = (input ?? {}) as Record<string, unknown>;
    if (typeof locale !== "string" || typeof key !== "string") {
      throw new Error("locale and key are required.");
    }
    return { locale, key };
  })
  .handler(async ({ data }): Promise<void> => {
    await getContentWriter().deleteMessage(data.locale, data.key);
  });

// --- Role bundles --------------------------------------------------------

export const listRoleBundles = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly ConfigBundle[]> => getConfigBundleStore("permission").list(),
);

export const saveRoleBundle = createServerFn({ method: "POST" })
  .validator(
    (
      input: unknown,
    ): {
      id?: string;
      name: string;
      items: string[];
      expectedVersion?: number;
      actor: string;
    } => {
      const { id, name, items, expectedVersion, actor } = (input ?? {}) as Record<string, unknown>;
      if (typeof name !== "string" || name.trim() === "") throw new Error("name is required.");
      if (!Array.isArray(items) || !items.every((item) => typeof item === "string")) {
        throw new Error("items must be a list of strings.");
      }
      return {
        id: typeof id === "string" ? id : undefined,
        name,
        items: items as string[],
        expectedVersion: typeof expectedVersion === "number" ? expectedVersion : undefined,
        actor: typeof actor === "string" ? actor : "unknown",
      };
    },
  )
  .handler(async ({ data }): Promise<ConfigBundle> => {
    const store = getConfigBundleStore("permission");
    const input: CreateBundleInput | UpdateBundleInput = { name: data.name, items: data.items };

    return data.id
      ? store.update(data.id, input, data.expectedVersion ?? 0, data.actor)
      : store.create(input as CreateBundleInput, data.actor);
  });

export const deleteRoleBundle = createServerFn({ method: "POST" })
  .validator((input: unknown): { id: string; expectedVersion: number; actor: string } => {
    const { id, expectedVersion, actor } = (input ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || typeof expectedVersion !== "number") {
      throw new Error("id and expectedVersion are required.");
    }
    return { id, expectedVersion, actor: typeof actor === "string" ? actor : "unknown" };
  })
  .handler(async ({ data }): Promise<void> => {
    await getConfigBundleStore("permission").delete(data.id, data.expectedVersion, data.actor);
  });

export const roleBundleHistory = createServerFn({ method: "GET" })
  .validator((input: unknown): { id: string } => {
    const id = (input as { id?: unknown })?.id;
    if (typeof id !== "string") throw new Error("id is required.");
    return { id };
  })
  .handler(async ({ data }): Promise<readonly ConfigBundleVersion[]> =>
    getConfigBundleStore("permission").history(data.id),
  );

// --- Route composition (section tree) ------------------------------------

/** A plain JSON object (not an array, not null) or throws. */
function asObject(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${what} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

/** Parses an untrusted value into a `RouteSectionNode[]`, rejecting anything malformed. */
function parseTree(value: unknown, depth = 0): RouteSectionNode[] {
  if (depth > 20) throw new Error("Section tree is nested too deeply.");
  if (!Array.isArray(value)) throw new Error("A section tree must be an array of nodes.");

  return value.map((raw): RouteSectionNode => {
    const node = asObject(raw ?? {}, "Every node");
    const ref = (node.ref ?? {}) as Record<string, unknown>;
    if (typeof node.instanceId !== "string" || node.instanceId === "") {
      throw new Error("Every node needs a non-empty instanceId.");
    }
    if (typeof ref.key !== "string" || ref.key === "") {
      throw new Error("Every node needs a ref.key.");
    }

    // `content` is `locale -> field bag`; every value must be a plain object.
    const content: Record<string, Record<string, JsonValue>> = {};
    for (const [locale, bag] of Object.entries(asObject(node.content ?? {}, "Node content"))) {
      content[locale] = asObject(bag, `Content for ${locale}`) as Record<string, JsonValue>;
    }

    const slots: Record<string, readonly RouteSectionNode[]> = {};
    for (const [name, children] of Object.entries(asObject(node.slots ?? {}, "Node slots"))) {
      slots[name] = parseTree(children, depth + 1);
    }

    return {
      instanceId: node.instanceId,
      ref: { key: ref.key, variant: typeof ref.variant === "string" ? ref.variant : "" },
      content,
      slots,
    };
  });
}

/** Optional string field off an untrusted object, or `undefined`. */
function optString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Parses an untrusted value into `Record<Locale, RouteSeo>`, dropping empty fields. */
function parseSeo(value: unknown): Record<string, RouteSeo> {
  const out: Record<string, RouteSeo> = {};
  for (const [locale, raw] of Object.entries(asObject(value ?? {}, "SEO"))) {
    const row = asObject(raw, `SEO for ${locale}`);
    const keywordsRaw = Array.isArray(row.keywords) ? row.keywords : [];
    const keywords = keywordsRaw.filter(
      (k): k is string => typeof k === "string" && k.trim() !== "",
    );
    const seo: RouteSeo = {
      ...(optString(row, "title") ? { title: optString(row, "title") } : {}),
      ...(optString(row, "description") ? { description: optString(row, "description") } : {}),
      ...(optString(row, "canonical") ? { canonical: optString(row, "canonical") } : {}),
      ...(optString(row, "ogImage") ? { ogImage: optString(row, "ogImage") } : {}),
      ...(keywords.length > 0 ? { keywords } : {}),
      ...(optString(row, "robots") ? { robots: optString(row, "robots") } : {}),
    };
    // Only keep a locale that actually carries something.
    if (Object.keys(seo).length > 0) out[locale] = seo;
  }
  return out;
}

/** Every route bundle's header, drafts included — the editor's route list. */
export const listRouteCompositions = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly RouteCompositionSummary[]> =>
    getRouteCompositionReader().listCompositions(),
);

/** One route's whole section tree, drafts included — for the route editor. */
export const loadRouteComposition = createServerFn({ method: "GET" })
  .validator((input: unknown): { bundleId: string } => {
    const bundleId = (input as { bundleId?: unknown } | undefined)?.bundleId;
    if (typeof bundleId !== "string" || bundleId.trim() === "") {
      throw new Error("bundleId is required.");
    }
    return { bundleId };
  })
  .handler(async ({ data }): Promise<RouteComposition | null> =>
    getRouteCompositionReader().getComposition(data.bundleId),
  );

/**
 * Creates (`bundleId` absent) or replaces a route's section tree. The tree is
 * validated against the section catalog here — an unknown section key is
 * rejected before the write, matching how `route_templates.template_key` is
 * validated at author time rather than by the database.
 */
export const saveRouteComposition = createServerFn({ method: "POST" })
  .validator(
    (
      input: unknown,
    ): {
      bundleId: string | null;
      name: string;
      path: string;
      published: boolean;
      tree: RouteSectionNode[];
      seo: Record<string, RouteSeo>;
      expectedVersion: number | null;
      actor: string;
    } => {
      const { bundleId, name, path, published, tree, seo, expectedVersion, actor } = (input ??
        {}) as Record<string, unknown>;
      if (typeof name !== "string" || name.trim() === "") throw new Error("name is required.");
      if (typeof path !== "string" || !path.startsWith("/")) {
        throw new Error("path is required and must start with /.");
      }
      return {
        bundleId: typeof bundleId === "string" && bundleId !== "" ? bundleId : null,
        name,
        path,
        published: Boolean(published),
        tree: parseTree(tree),
        seo: parseSeo(seo),
        expectedVersion: typeof expectedVersion === "number" ? expectedVersion : null,
        actor: typeof actor === "string" ? actor : "unknown",
      };
    },
  )
  .handler(async ({ data }): Promise<RouteBundle> => {
    const unknown = findUnknownSectionRefs(sectionCatalog, flattenTree(data.tree));
    if (unknown.length > 0) {
      throw new Error(`Unknown section(s): ${unknown.map((ref) => ref.key).join(", ")}`);
    }

    return getRouteCompositionWriter().saveComposition(
      data.bundleId,
      {
        name: data.name,
        path: data.path,
        published: data.published,
        tree: data.tree,
        seo: data.seo,
      },
      data.expectedVersion,
      data.actor,
    );
  });

/** Deletes a route bundle and its whole section tree. */
export const deleteRouteComposition = createServerFn({ method: "POST" })
  .validator((input: unknown): { bundleId: string; expectedVersion: number; actor: string } => {
    const { bundleId, expectedVersion, actor } = (input ?? {}) as Record<string, unknown>;
    if (typeof bundleId !== "string" || typeof expectedVersion !== "number") {
      throw new Error("bundleId and expectedVersion are required.");
    }
    return { bundleId, expectedVersion, actor: typeof actor === "string" ? actor : "unknown" };
  })
  .handler(async ({ data }): Promise<void> => {
    await getRouteCompositionWriter().deleteComposition(
      data.bundleId,
      data.expectedVersion,
      data.actor,
    );
  });

export interface PublishGap {
  locale: string;
  /** The offending section instance in the tree. */
  instanceId: string;
  sectionKey: string;
  /** Field names still missing, or `["*"]` when the instance has no content in this locale at all. */
  missing: string[];
}

export interface PublishReadiness {
  ready: boolean;
  gaps: PublishGap[];
}

/**
 * Whether a tree can be published: every section instance in it must have
 * complete content — every required field present and well-typed — in every
 * configured site locale. The route owns the content, so this walks the
 * tree's nodes directly; there is no separate content store to consult.
 */
export const checkRoutePublishReadiness = createServerFn({ method: "POST" })
  .validator((input: unknown): { tree: RouteSectionNode[] } => ({
    tree: parseTree((input as { tree?: unknown } | undefined)?.tree),
  }))
  .handler(async ({ data }): Promise<PublishReadiness> => {
    const locales = await getSiteSettingsStore().getLocales();
    const gaps: PublishGap[] = [];

    for (const node of flattenNodes(data.tree)) {
      const def = sectionCatalog.byKey.get(node.ref.key);
      for (const { locale } of locales) {
        const fields = node.content[locale] ?? {};
        if (Object.keys(fields).length === 0) {
          gaps.push({
            locale,
            instanceId: node.instanceId,
            sectionKey: node.ref.key,
            missing: ["*"],
          });
          continue;
        }
        const issues = def ? validateSectionFields(def, fields) : [];
        if (issues.length > 0) {
          gaps.push({
            locale,
            instanceId: node.instanceId,
            sectionKey: node.ref.key,
            missing: issues.map((issue) => issue.field),
          });
        }
      }
    }

    return { ready: gaps.length === 0, gaps };
  });
