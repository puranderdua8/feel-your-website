import type {
  ConfigBundle,
  ConfigBundleVersion,
  CreateBundleInput,
  UpdateBundleInput,
} from "@feel-your-website/config-schema";
import type {
  Content,
  JsonValue,
  RouteBundle,
  RouteComposition,
  RouteCompositionSummary,
  RouteSectionNode,
  SiteLocale,
} from "@feel-your-website/content-core";
import {
  collectEffectiveRefs,
  findUnknownSectionRefs,
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

function asFields(input: unknown): Record<string, JsonValue> {
  if (typeof input !== "object" || input === null) {
    throw new Error("fields must be a JSON object.");
  }
  return input as Record<string, JsonValue>;
}

export const listContentItems = createServerFn({ method: "GET" })
  .validator((input: unknown): { locale: string } => {
    const locale = (input as { locale?: unknown } | undefined)?.locale;
    return { locale: typeof locale === "string" && locale.trim() !== "" ? locale : "en" };
  })
  .handler(async ({ data }): Promise<readonly Content[]> => {
    // Default-variant rows for the chosen locale — the Sections surface (a
    // later phase) lists named variants separately.
    const page = await getContentAdapter().listContent({ locale: data.locale, limit: 100 });
    return page.items;
  });

export const saveContentItem = createServerFn({ method: "POST" })
  .validator(
    (
      input: unknown,
    ): {
      templateKey: string;
      locale: string;
      fields: Record<string, JsonValue>;
      variant: string;
    } => {
      const { templateKey, locale, fields, variant } = (input ?? {}) as Record<string, unknown>;
      if (typeof templateKey !== "string" || templateKey.trim() === "") {
        throw new Error("templateKey is required.");
      }
      if (typeof locale !== "string" || locale.trim() === "") {
        throw new Error("locale is required.");
      }
      return {
        templateKey,
        locale,
        fields: asFields(fields),
        variant: typeof variant === "string" ? variant : "",
      };
    },
  )
  .handler(async ({ data }): Promise<Content> =>
    getContentWriter().saveContentItem(data.templateKey, data.locale, data.fields, data.variant),
  );

export const deleteContentItem = createServerFn({ method: "POST" })
  .validator((input: unknown): { templateKey: string; locale: string; variant: string } => {
    const { templateKey, locale, variant } = (input ?? {}) as Record<string, unknown>;
    if (typeof templateKey !== "string" || typeof locale !== "string") {
      throw new Error("templateKey and locale are required.");
    }
    return { templateKey, locale, variant: typeof variant === "string" ? variant : "" };
  })
  .handler(async ({ data }): Promise<void> => {
    await getContentWriter().deleteContentItem(data.templateKey, data.locale, data.variant);
  });

/**
 * One section's content for one exact `(key, variant, locale)` — for the
 * Sections editor to load whatever the author selected.
 *
 * A locale-fallback result (`translated: false`) is treated as "nothing
 * here": the editor edits one specific row, so surfacing the default
 * locale's copy under an untranslated locale would make an unfilled
 * language look filled. `null` in that case; the editor shows an empty form.
 */
export const getSectionContent = createServerFn({ method: "GET" })
  .validator((input: unknown): { key: string; variant: string; locale: string } => {
    const { key, variant, locale } = (input ?? {}) as Record<string, unknown>;
    if (typeof key !== "string" || key.trim() === "") throw new Error("key is required.");
    if (typeof locale !== "string" || locale.trim() === "") throw new Error("locale is required.");
    return { key, variant: typeof variant === "string" ? variant : "", locale };
  })
  .handler(async ({ data }): Promise<Content | null> => {
    const content = await getContentAdapter().getContent(data.key, data.locale, data.variant);
    return content && content.translated ? content : null;
  });

/**
 * The configured content locales — what the header language switcher and,
 * later, the publish-completeness gate iterate. Read-only here; editing the
 * set is the Languages surface's job (a later phase).
 */
export const listSiteLocales = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly SiteLocale[]> => getSiteSettingsStore().getLocales(),
);

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

// --- Route bundles ---------------------------------------------------------

export const listRouteBundles = createServerFn({ method: "GET" }).handler(
  async (): Promise<readonly ConfigBundle[]> => getConfigBundleStore("template_key").list(),
);

export const saveRouteBundle = createServerFn({ method: "POST" })
  .validator(
    (
      input: unknown,
    ): {
      id?: string;
      name: string;
      path: string;
      items: string[];
      published: boolean;
      expectedVersion?: number;
      actor: string;
    } => {
      const { id, name, path, items, published, expectedVersion, actor } = (input ?? {}) as Record<
        string,
        unknown
      >;
      if (typeof name !== "string" || name.trim() === "") throw new Error("name is required.");
      if (typeof path !== "string" || !path.startsWith("/")) {
        throw new Error("path is required and must start with /.");
      }
      if (!Array.isArray(items) || !items.every((item) => typeof item === "string")) {
        throw new Error("items must be a list of strings.");
      }
      return {
        id: typeof id === "string" ? id : undefined,
        name,
        path,
        items: items as string[],
        published: Boolean(published),
        expectedVersion: typeof expectedVersion === "number" ? expectedVersion : undefined,
        actor: typeof actor === "string" ? actor : "unknown",
      };
    },
  )
  .handler(async ({ data }): Promise<ConfigBundle> => {
    const store = getConfigBundleStore("template_key");
    const input = {
      name: data.name,
      items: data.items,
      path: data.path,
      published: data.published,
    };

    return data.id
      ? store.update(data.id, input, data.expectedVersion ?? 0, data.actor)
      : store.create(input, data.actor);
  });

export const deleteRouteBundle = createServerFn({ method: "POST" })
  .validator((input: unknown): { id: string; expectedVersion: number; actor: string } => {
    const { id, expectedVersion, actor } = (input ?? {}) as Record<string, unknown>;
    if (typeof id !== "string" || typeof expectedVersion !== "number") {
      throw new Error("id and expectedVersion are required.");
    }
    return { id, expectedVersion, actor: typeof actor === "string" ? actor : "unknown" };
  })
  .handler(async ({ data }): Promise<void> => {
    await getConfigBundleStore("template_key").delete(data.id, data.expectedVersion, data.actor);
  });

// --- Route composition (section tree) ------------------------------------

/** Parses an untrusted value into a `RouteSectionNode[]`, rejecting anything malformed. */
function parseTree(value: unknown, depth = 0): RouteSectionNode[] {
  if (depth > 20) throw new Error("Section tree is nested too deeply.");
  if (!Array.isArray(value)) throw new Error("A section tree must be an array of nodes.");

  return value.map((raw): RouteSectionNode => {
    const node = (raw ?? {}) as Record<string, unknown>;
    const ref = (node.ref ?? {}) as Record<string, unknown>;
    if (typeof node.instanceId !== "string" || node.instanceId === "") {
      throw new Error("Every node needs a non-empty instanceId.");
    }
    if (typeof ref.key !== "string" || ref.key === "") {
      throw new Error("Every node needs a ref.key.");
    }

    const slotsIn = (node.slots ?? {}) as Record<string, unknown>;
    const slots: Record<string, readonly RouteSectionNode[]> = {};
    for (const [name, children] of Object.entries(slotsIn)) {
      slots[name] = parseTree(children, depth + 1);
    }

    return {
      instanceId: node.instanceId,
      ref: { key: ref.key, variant: typeof ref.variant === "string" ? ref.variant : "" },
      slots,
    };
  });
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
      expectedVersion: number | null;
      actor: string;
    } => {
      const { bundleId, name, path, published, tree, expectedVersion, actor } = (input ??
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
      { name: data.name, path: data.path, published: data.published, tree: data.tree },
      data.expectedVersion,
      data.actor,
    );
  });

export interface PublishGap {
  locale: string;
  sectionKey: string;
  variant: string;
  /** Field names still missing, or `["*"]` when the section has no content in this locale at all. */
  missing: string[];
}

export interface PublishReadiness {
  ready: boolean;
  gaps: PublishGap[];
}

/**
 * Whether a tree can be published: every section it effectively depends on
 * (including the default of a required slot left empty) must have complete,
 * translated content in every configured site locale. A locale-fallback
 * result counts as missing — an untranslated language is not "done".
 */
export const checkRoutePublishReadiness = createServerFn({ method: "POST" })
  .validator((input: unknown): { tree: RouteSectionNode[] } => ({
    tree: parseTree((input as { tree?: unknown } | undefined)?.tree),
  }))
  .handler(async ({ data }): Promise<PublishReadiness> => {
    const [locales, refs] = [
      await getSiteSettingsStore().getLocales(),
      collectEffectiveRefs(sectionCatalog, data.tree),
    ];
    const adapter = getContentAdapter();
    const gaps: PublishGap[] = [];

    for (const ref of refs) {
      const def = sectionCatalog.byKey.get(ref.key);
      for (const { locale } of locales) {
        const content = await adapter.getContent(ref.key, locale, ref.variant);
        if (!content || !content.translated) {
          gaps.push({ locale, sectionKey: ref.key, variant: ref.variant, missing: ["*"] });
          continue;
        }
        const issues = def ? validateSectionFields(def, content.fields) : [];
        if (issues.length > 0) {
          gaps.push({
            locale,
            sectionKey: ref.key,
            variant: ref.variant,
            missing: issues.map((issue) => issue.field),
          });
        }
      }
    }

    return { ready: gaps.length === 0, gaps };
  });
