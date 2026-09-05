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
  RouteParamSpec,
  RouteSectionNode,
  RouteSeo,
  SiteLocale,
} from "@feel-your-website/content-core";
import {
  findUnknownSectionKeys,
  flattenNodes,
  flattenTree,
  validateSectionFields,
} from "@feel-your-website/content-core";
import { platformCatalog, resolvePermissions } from "@feel-your-website/rbac";
import { OUTLET_SECTION_KEY, sectionCatalog } from "@feel-your-website/section-registry";
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
import { composeCandidatePath, parseParams, validateRouteInput } from "./route-input.js";

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

// Section content lives on each route section instance (see
// `saveRouteComposition` below); `ContentWriter` is UI-chrome messages only.

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
    if (typeof node.instanceId !== "string" || node.instanceId === "") {
      throw new Error("Every node needs a non-empty instanceId.");
    }
    if (typeof node.sectionKey !== "string" || node.sectionKey === "") {
      throw new Error("Every node needs a non-empty sectionKey.");
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

    return { instanceId: node.instanceId, sectionKey: node.sectionKey, content, slots };
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

/** Number of `outlet` marker nodes anywhere in the tree — at most one is allowed. */
function countOutlets(tree: readonly RouteSectionNode[]): number {
  let count = 0;
  for (const node of flattenNodes(tree)) {
    if (node.sectionKey === OUTLET_SECTION_KEY) count += 1;
  }
  return count;
}

/**
 * Creates (`bundleId` absent) or replaces a route's section tree, path,
 * hierarchy and parameters. `validateRouteInput` — the same pure module the
 * editor's live preview runs — is the authority here for everything the
 * database's own constraints and RPC checks can't express (reserved paths,
 * param/label bookkeeping, SEO placeholders); `save_route_composition` is the
 * transactional backstop for the rest (cycles, publish ordering, collisions).
 */
export const saveRouteComposition = createServerFn({ method: "POST" })
  .validator(
    (
      input: unknown,
    ): {
      bundleId: string | null;
      name: string;
      parentId: string | null;
      pathSegment: string;
      params: RouteParamSpec[];
      published: boolean;
      tree: RouteSectionNode[];
      seo: Record<string, RouteSeo>;
      expectedVersion: number | null;
      actor: string;
    } => {
      const {
        bundleId,
        name,
        parentId,
        pathSegment,
        params,
        published,
        tree,
        seo,
        expectedVersion,
        actor,
      } = (input ?? {}) as Record<string, unknown>;
      if (typeof name !== "string" || name.trim() === "") throw new Error("name is required.");
      if (typeof pathSegment !== "string" || pathSegment.trim() === "") {
        throw new Error("A path is required.");
      }
      return {
        bundleId: typeof bundleId === "string" && bundleId !== "" ? bundleId : null,
        name,
        parentId: typeof parentId === "string" && parentId !== "" ? parentId : null,
        pathSegment,
        params: parseParams(params),
        published: Boolean(published),
        tree: parseTree(tree),
        seo: parseSeo(seo),
        expectedVersion: typeof expectedVersion === "number" ? expectedVersion : null,
        actor: typeof actor === "string" ? actor : "unknown",
      };
    },
  )
  .handler(async ({ data }): Promise<RouteBundle> => {
    const unknown = findUnknownSectionKeys(sectionCatalog, flattenTree(data.tree)).filter(
      (key) => key !== OUTLET_SECTION_KEY,
    );
    if (unknown.length > 0) {
      throw new Error(`Unknown section(s): ${unknown.join(", ")}`);
    }
    const outletCount = countOutlets(data.tree);
    if (outletCount > 1) {
      throw new Error("A route can carry only one outlet.");
    }

    const siblings = await getRouteCompositionReader().listCompositions();

    // Computed here, not trusted from the client: `hasChildren` gates a
    // blocking publish rule below, so it must reflect the real sibling set,
    // not whatever the editor's local state happened to send.
    const hasChildren =
      data.bundleId !== null && siblings.some((s) => s.parentId === data.bundleId);
    // `checkRoutePublishReadiness` surfaces this same rule to the editor as a
    // live, non-authoritative hint — but that check is opt-in (a button the
    // author can simply never press) and never runs on the actual save path.
    // Publishing a layout with no outlet means its children render as
    // orphaned standalone pages with no chrome, so this is enforced here too,
    // unconditionally, the same way the single-outlet rule above already is.
    if (data.published && hasChildren && outletCount === 0) {
      throw new Error(
        "This route has children but no outlet — add one before publishing, or they will render as standalone pages with no layout.",
      );
    }

    const issues = validateRouteInput({
      bundleId: data.bundleId,
      parentId: data.parentId,
      pathSegment: data.pathSegment,
      params: data.params,
      published: data.published,
      seo: data.seo,
      siblings,
    });
    if (issues.length > 0) {
      throw new Error(issues.map((issue) => issue.message).join(" "));
    }

    const path = composeCandidatePath({
      parentId: data.parentId,
      pathSegment: data.pathSegment,
      siblings,
    });
    // `validateRouteInput` above already confirmed this composes cleanly.
    if (!path) throw new Error("That path is not valid.");

    return getRouteCompositionWriter().saveComposition(
      data.bundleId,
      {
        name: data.name,
        path,
        pathSegment: data.pathSegment,
        parentId: data.parentId,
        params: data.params,
        published: data.published,
        tree: data.tree,
        seo: data.seo,
      },
      data.expectedVersion,
      data.actor,
    );
  });

/** Deletes a route bundle and its whole section tree. Refuses if it still has children. */
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

/** Deletes a route bundle **and every descendant route** — the explicit, confirmed counterpart above. */
export const deleteRouteSubtree = createServerFn({ method: "POST" })
  .validator((input: unknown): { bundleId: string; expectedVersion: number; actor: string } => {
    const { bundleId, expectedVersion, actor } = (input ?? {}) as Record<string, unknown>;
    if (typeof bundleId !== "string" || typeof expectedVersion !== "number") {
      throw new Error("bundleId and expectedVersion are required.");
    }
    return { bundleId, expectedVersion, actor: typeof actor === "string" ? actor : "unknown" };
  })
  .handler(async ({ data }): Promise<void> => {
    await getRouteCompositionWriter().deleteSubtree(
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

/** A structural (not per-locale-content) publish concern. */
export interface StructuralIssue {
  message: string;
  /** Blocks publish; `false` is a warning shown but not enforced. */
  blocking: boolean;
}

export interface PublishReadiness {
  ready: boolean;
  gaps: PublishGap[];
  structuralIssues: StructuralIssue[];
}

/**
 * Whether a tree can be published: every section instance in it must have
 * complete content — every required field present and well-typed — in every
 * configured site locale — and the tree's `outlet` usage must make sense for
 * whether this route actually has children. The route owns the content, so
 * this walks the tree's nodes directly; there is no separate content store to
 * consult. `hasChildren` is supplied by the caller (the editor already has the
 * full route list loaded) rather than re-fetched here.
 */
export const checkRoutePublishReadiness = createServerFn({ method: "POST" })
  .validator((input: unknown): { tree: RouteSectionNode[]; hasChildren: boolean } => {
    const row = (input ?? {}) as Record<string, unknown>;
    return { tree: parseTree(row.tree), hasChildren: Boolean(row.hasChildren) };
  })
  .handler(async ({ data }): Promise<PublishReadiness> => {
    const locales = await getSiteSettingsStore().getLocales();
    const gaps: PublishGap[] = [];

    for (const node of flattenNodes(data.tree)) {
      // The outlet marks where a child renders; it carries no content of its
      // own and is never a translation gap.
      if (node.sectionKey === OUTLET_SECTION_KEY) continue;

      const def = sectionCatalog.byKey.get(node.sectionKey);
      for (const { locale } of locales) {
        const fields = node.content[locale] ?? {};

        // `validateSectionFields` is the authority on whether an instance's
        // content is complete for a locale: a section whose fields are all
        // optional (e.g. `card`, which is really about its slots) is complete
        // with an empty bag, and must not be flagged just for being empty.
        if (def) {
          const issues = validateSectionFields(def, fields);
          if (issues.length > 0) {
            gaps.push({
              locale,
              instanceId: node.instanceId,
              sectionKey: node.sectionKey,
              missing: issues.map((issue) => issue.field),
            });
          }
          continue;
        }

        // No catalog entry — `saveRouteComposition` rejects unknown keys, so
        // this is unreachable in practice, but if it happens we can't judge
        // completeness, so treat any missing content as a gap.
        if (Object.keys(fields).length === 0) {
          gaps.push({
            locale,
            instanceId: node.instanceId,
            sectionKey: node.sectionKey,
            missing: ["*"],
          });
        }
      }
    }

    const outletCount = countOutlets(data.tree);
    const structuralIssues: StructuralIssue[] = [];
    if (outletCount > 1) {
      structuralIssues.push({ message: "A route can carry only one outlet.", blocking: true });
    } else if (data.hasChildren && outletCount === 0) {
      structuralIssues.push({
        message: "This route has children but no outlet — they won't render inside it.",
        blocking: true,
      });
    } else if (!data.hasChildren && outletCount === 1) {
      structuralIssues.push({
        message: "This route has an outlet but no children yet.",
        blocking: false,
      });
    }

    return {
      ready: gaps.length === 0 && structuralIssues.every((issue) => !issue.blocking),
      gaps,
      structuralIssues,
    };
  });
