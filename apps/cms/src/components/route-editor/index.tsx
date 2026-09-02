import type {
  JsonValue,
  RouteCompositionSummary,
  RouteSectionNode,
  RouteSeo,
} from "@feel-your-website/content-core";
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
import { useCallback, useEffect, useState } from "react";

import { useContentLocale } from "@/i18n/content-locale";
import {
  deleteRouteComposition,
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
import { SeoPanel } from "./seo-panel.js";
import { findNode, setNodeContent } from "./tree-ops.js";

/**
 * The Routes surface: a list on the left, and on the right a route's section
 * tree, a schema form for the selected section's content at the active
 * locale, a live in-process preview, and a publish bar gated on per-locale
 * completeness.
 *
 * The route owns everything now — the section tree *and* every instance's
 * per-locale content — so there is one save (`saveRouteComposition`) and the
 * preview renders straight off the draft tree.
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
  seo: Readonly<Record<string, RouteSeo>>;
};

const BLANK: OpenRoute = {
  bundleId: null,
  version: null,
  name: "",
  path: "/",
  published: false,
  tree: [],
  seo: {},
};

function RouteEditorInner({ actor }: { actor: string }) {
  const { contentLocale } = useContentLocale();
  const [routes, setRoutes] = useState<readonly RouteCompositionSummary[]>([]);
  const [open, setOpen] = useState<OpenRoute | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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
      seo: composition.seo,
    });
  }, []);

  function startNew() {
    setError(null);
    setSelectedNodeId(null);
    setOpen({ ...BLANK });
  }

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
          seo: open.seo,
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
    await deleteRouteComposition({
      data: { bundleId: open.bundleId, expectedVersion: open.version, actor },
    });
    setOpen(null);
    await refresh();
  }

  const selectedNode = open && selectedNodeId ? findNode(open.tree, selectedNodeId) : null;

  function editSelectedContent(fields: Record<string, JsonValue>) {
    if (!open || !selectedNode) return;
    setOpen({
      ...open,
      tree: setNodeContent(open.tree, selectedNode.instanceId, contentLocale, fields),
    });
  }

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
                    key={`${selectedNode.instanceId}:${contentLocale}`}
                    sectionKey={selectedNode.ref.key}
                    locale={contentLocale}
                    fields={selectedNode.content[contentLocale] ?? {}}
                    onChange={editSelectedContent}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Select a section in the tree to edit its content.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
            </CardHeader>
            <CardContent>
              <SeoPanel
                key={contentLocale}
                locale={contentLocale}
                seo={open.seo[contentLocale] ?? {}}
                onChange={(seo) => setOpen({ ...open, seo: { ...open.seo, [contentLocale]: seo } })}
              />
            </CardContent>
          </Card>

          <RoutePreview tree={open.tree} locale={contentLocale} />

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
