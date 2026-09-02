import type {
  ConfigBundle,
  ConfigBundleVersion,
  CreateBundleInput,
  UpdateBundleInput,
} from "@feel-your-website/config-schema";
import type { Content, JsonValue } from "@feel-your-website/content-core";
import { platformCatalog, resolvePermissions } from "@feel-your-website/rbac";
import { createServerFn } from "@tanstack/react-start";

import {
  getAuthProvider,
  getConfigBundleStore,
  getContentAdapter,
  getContentWriter,
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
