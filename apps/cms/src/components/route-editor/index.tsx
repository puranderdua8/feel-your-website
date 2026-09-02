import type {
  Content,
  JsonValue,
  RouteCompositionSummary,
  RouteSectionNode,
  SectionRef,
} from "@feel-your-website/content-core";
import { flattenTree } from "@feel-your-website/content-core";
import { Can } from "@feel-your-website/rbac/react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@feel-your-website/ui";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useContentLocale } from "@/i18n/content-locale";
import {
  deleteRouteBundle,
  getSectionContent,
  listRouteCompositions,
  loadRouteComposition,
  saveRouteComposition,
} from "@/server/bff";

import { LockedNotice } from "../locked-notice.js";
import { RouteList } from "./route-list.js";
import { RoutePreview } from "./route-preview.js";
import { PublishBar } from "./publish-bar.js";
import { SectionFieldForm } from "./section-field-form.js";
import { SectionTree } from "./section-tree.js";
import { findNode, refKey } from "./tree-ops.js";

/**
 * The Routes surface: a list on the left, and on the right a route's section
 * tree, a schema form for the selected section, a live in-process preview,
 * and a publish bar gated on per-locale completeness.
 */
export function RouteEditor({ actor }: { actor: string }) {
  return (
    <Can permission="manage:routes" fallback={<LockedNotice permission="manage:routes" />}>
      <RouteEditorInner actor={actor} />
    </Can>
  );
}

type OpenRoute = {
  bundleId: string | null;
  version: number | null;
  name: string;
  path: string;
  published: boolean;
  tree: readonly RouteSectionNode[];
};

const BLANK: OpenRoute = {
  bundleId: null,
  version: null,
  name: "",
  path: "/",
  published: false,
  tree: [],
};

function RouteEditorInner({ actor }: { actor: string }) {
  const { contentLocale } = useContentLocale();
  const [routes, setRoutes] = useState<readonly RouteCompositionSummary[]>([]);
  const [open, setOpen] = useState<OpenRoute | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contentByRef, setContentByRef] = useState<Record<string, Content | null>>({});
  const [draftByRef, setDraftByRef] = useState<Record<string, Readonly<Record<string, JsonValue>>>>(
    {},
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRoutes(await listRouteCompositions());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openRoute = useCallback(async (bundleId: string) => {
    setError(null);
    setSelectedNodeId(null);
    setContentByRef({});
    setDraftByRef({});
    const composition = await loadRouteComposition({ data: { bundleId } });
    if (!composition) {
      setError("That route could not be loaded.");
      return;
    }
    setOpen({
      bundleId: composition.id,
      version: composition.version,
      name: composition.name,
      path: composition.path,
      published: composition.published,
      tree: composition.tree,
    });
  }, []);

  function startNew() {
    setError(null);
    setSelectedNodeId(null);
    setContentByRef({});
    setDraftByRef({});
    setOpen({ ...BLANK });
  }

  // Fetch content for every ref the tree references, for the preview.
  useEffect(() => {
    if (!open) return;
    const refs = flattenTree(open.tree);
    let cancelled = false;
    void (async () => {
      for (const ref of refs) {
        const key = refKey(ref);
        if (key in contentByRef) continue;
        const content = await getSectionContent({
          data: { key: ref.key, variant: ref.variant, locale: contentLocale },
        });
        if (cancelled) return;
        setContentByRef((current) => ({ ...current, [key]: content }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-fetch from scratch when the locale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.tree, contentLocale]);

  useEffect(() => {
    setContentByRef({});
    setDraftByRef({});
  }, [contentLocale]);

  const resolveContent = useMemo(() => {
    return (ref: SectionRef): Content | null => {
      const key = refKey(ref);
      const draft = draftByRef[key];
      if (draft) {
        return {
          templateKey: ref.key,
          variant: ref.variant,
          locale: contentLocale,
          translated: true,
          fields: draft,
          updatedAt: "",
        };
      }
      return contentByRef[key] ?? null;
    };
  }, [contentByRef, draftByRef, contentLocale]);

  async function save(published: boolean) {
    if (!open) return;
    setPending(true);
    setError(null);
    try {
      const saved = await saveRouteComposition({
        data: {
          bundleId: open.bundleId ?? undefined,
          name: open.name,
          path: open.path,
          published,
          tree: open.tree,
          expectedVersion: open.version ?? undefined,
          actor,
        },
      });
      setOpen({ ...open, bundleId: saved.id, version: saved.version, published });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function removeRoute() {
    if (!open?.bundleId || open.version === null) return;
    await deleteRouteBundle({
      data: { id: open.bundleId, expectedVersion: open.version, actor },
    });
    setOpen(null);
    await refresh();
  }

  const selectedNode = open && selectedNodeId ? findNode(open.tree, selectedNodeId) : null;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <RouteList
        routes={routes}
        selectedId={open?.bundleId ?? null}
        onSelect={(id) => void openRoute(id)}
        onNew={startNew}
      />

      {!open ? (
        <Card className="flex-1">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Select a route, or create one.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{open.bundleId ? open.name || "Route" : "New route"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="route-name">Name</Label>
                  <Input
                    id="route-name"
                    value={open.name}
                    onChange={(e) => setOpen({ ...open, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="route-path">Path</Label>
                  <Input
                    id="route-path"
                    value={open.path}
                    onChange={(e) => setOpen({ ...open, path: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="route-published"
                  checked={open.published}
                  onCheckedChange={(checked) => setOpen({ ...open, published: checked })}
                />
                <Label htmlFor="route-published">Published</Label>
                {open.bundleId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => void removeRoute()}
                  >
                    Delete route
                  </Button>
                )}
              </div>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sections</CardTitle>
              </CardHeader>
              <CardContent>
                <SectionTree
                  tree={open.tree}
                  selectedId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                  onChange={(tree) => setOpen({ ...open, tree })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedNode ? "Section content" : "Content"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNode ? (
                  <SectionFieldForm
                    key={`${selectedNode.ref.key}:${selectedNode.ref.variant}:${contentLocale}`}
                    sectionKey={selectedNode.ref.key}
                    variant={selectedNode.ref.variant}
                    locale={contentLocale}
                    onEdit={(fields) =>
                      setDraftByRef((current) => ({
                        ...current,
                        [refKey(selectedNode.ref)]: fields,
                      }))
                    }
                    onSaved={(content) => {
                      const key = refKey(selectedNode.ref);
                      setContentByRef((current) => ({ ...current, [key]: content }));
                      setDraftByRef((current) => {
                        const next = { ...current };
                        delete next[key];
                        return next;
                      });
                    }}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Select a section in the tree to edit its content.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <RoutePreview tree={open.tree} resolveContent={resolveContent} />

          <PublishBar
            tree={open.tree}
            pending={pending}
            onSaveDraft={() => void save(false)}
            onPublish={() => void save(true)}
          />
        </div>
      )}
    </div>
  );
}
