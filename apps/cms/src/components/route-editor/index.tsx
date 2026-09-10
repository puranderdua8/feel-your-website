import type {
  JsonValue,
  RouteCompositionSummary,
  RouteParamSpec,
  RouteSectionNode,
  RouteSeo,
} from "@feel-your-website/content-core";
import {
  OUTLET_SECTION_KEY,
  parseRoutePattern,
  treeHasOutlet,
} from "@feel-your-website/content-core";
import { Can } from "@feel-your-website/rbac/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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
  deleteRouteSubtree,
  listRouteCompositions,
  loadRouteComposition,
  saveRouteComposition,
} from "@/server/bff";
import { composeCandidatePath } from "@/server/route-input";

import { LockedNotice } from "../locked-notice.js";
import { descendantIds } from "./route-hierarchy.js";
import { ParamEditor } from "./param-editor.js";
import { ParentPicker } from "./parent-picker.js";
import { PathBuilder } from "./path-builder.js";
import { PathPatternPreview } from "./path-pattern-preview.js";
import { RouteList } from "./route-list.js";
import { RoutePreview } from "./route-preview.js";
import { PublishBar } from "./publish-bar.js";
import { SectionFieldForm } from "./section-field-form.js";
import { SectionTree } from "./section-tree.js";
import { SeoPanel } from "./seo-panel.js";
import { findNode, newOutletNode, setNodeContent } from "./tree-ops.js";

/**
 * The Routes surface: a hierarchy on the left, and on the right a route's
 * path/parent/parameters, its section tree, a schema form for the selected
 * section's content, a live in-process preview, and a publish bar gated on
 * per-locale completeness plus outlet/children structure.
 *
 * The route owns everything now — path, hierarchy, params, the section tree,
 * and every instance's per-locale content — so there is one save
 * (`saveRouteComposition`) and the preview renders straight off the draft.
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
  parentId: string | null;
  /** This route's own path contribution — the whole path for a root, one segment for a child. */
  pathSegment: string;
  params: RouteParamSpec[];
  published: boolean;
  tree: readonly RouteSectionNode[];
  seo: Readonly<Record<string, RouteSeo>>;
};

const BLANK: OpenRoute = {
  bundleId: null,
  version: null,
  name: "",
  parentId: null,
  pathSegment: "/",
  params: [],
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
      parentId: composition.parentId,
      pathSegment: composition.pathSegment,
      params: [...composition.params],
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
          parentId: open.parentId,
          pathSegment: open.pathSegment,
          params: open.params,
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
    try {
      await deleteRouteComposition({
        data: { bundleId: open.bundleId, expectedVersion: open.version, actor },
      });
      setOpen(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  async function removeSubtree() {
    if (!open?.bundleId || open.version === null) return;
    try {
      await deleteRouteSubtree({
        data: { bundleId: open.bundleId, expectedVersion: open.version, actor },
      });
      setOpen(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  const selectedNode = open && selectedNodeId ? findNode(open.tree, selectedNodeId) : null;

  function editSelectedContent(fields: Record<string, JsonValue>) {
    if (!open || !selectedNode) return;
    setOpen({
      ...open,
      tree: setNodeContent(open.tree, selectedNode.instanceId, contentLocale, fields),
    });
  }

  const children = open?.bundleId ? routes.filter((r) => r.parentId === open.bundleId) : [];
  const hasPublishedChildren = children.some((c) => c.published);
  const descendants = open?.bundleId ? descendantIds(open.bundleId, routes) : new Set<string>();
  const parent = open?.parentId ? (routes.find((r) => r.id === open.parentId) ?? null) : null;
  const parentPath = parent?.path ?? null;
  /** `null` when this route is top-level; otherwise whether its parent is a layout. */
  const parentHasOutlet = open?.parentId ? (parent?.hasOutlet ?? false) : null;
  const treeHasOutletNow = open ? treeHasOutlet(open.tree) : false;
  const composedPath = open
    ? composeCandidatePath({
        parentId: open.parentId,
        pathSegment: open.pathSegment,
        siblings: routes,
      })
    : null;
  const paramNames = composedPath ? safeParamNames(composedPath) : [];

  async function addOutletToParent(parentId: string) {
    setError(null);
    setPending(true);
    try {
      const p = await loadRouteComposition({ data: { bundleId: parentId } });
      if (!p) {
        setError("Couldn't load the parent route.");
        return;
      }
      if (!treeHasOutlet(p.tree)) {
        await saveRouteComposition({
          data: {
            bundleId: p.id,
            name: p.name,
            parentId: p.parentId,
            pathSegment: p.pathSegment,
            params: p.params,
            published: p.published,
            tree: [...p.tree, newOutletNode()],
            seo: p.seo,
            expectedVersion: p.version,
            actor,
          },
        });
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't add the outlet.");
    } finally {
      setPending(false);
    }
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
                <ParentPicker
                  routes={routes}
                  selfId={open.bundleId}
                  value={open.parentId}
                  onChange={(parentId) => {
                    // A root's pathSegment is a whole absolute pattern
                    // (leading `/`); a child's is one bare segment (none).
                    // Crossing that boundary invalidates whatever text was
                    // there, so start that side fresh rather than composing
                    // something like a lone "/" as a child's segment.
                    const wasRoot = open.parentId === null;
                    const willBeRoot = parentId === null;
                    const pathSegment =
                      wasRoot === willBeRoot ? open.pathSegment : willBeRoot ? "/" : "";
                    setOpen({ ...open, parentId, pathSegment });
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Path</Label>
                <PathBuilder
                  parentPath={parentPath}
                  pathSegment={open.pathSegment}
                  onChange={(pathSegment) => setOpen({ ...open, pathSegment })}
                />
              </div>

              <PathPatternPreview
                bundleId={open.bundleId}
                parentId={open.parentId}
                pathSegment={open.pathSegment}
                params={open.params}
                published={open.published}
                seo={open.seo}
                siblings={routes}
              />

              {parent && parentHasOutlet === false && (
                <div className="border-destructive/40 bg-destructive/5 text-destructive flex flex-wrap items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-sm">
                  <span>
                    <strong>{parent.name}</strong> has no outlet — this route can&rsquo;t be
                    published inside it until you add one.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void addOutletToParent(parent.id)}
                  >
                    Add an outlet to {parent.name}
                  </Button>
                </div>
              )}

              <ParamEditor
                paramNames={paramNames}
                params={open.params}
                onChange={(params) => setOpen({ ...open, params })}
              />

              <div className="flex items-center gap-2">
                <Switch
                  id="route-published"
                  checked={open.published}
                  onCheckedChange={(checked) => setOpen({ ...open, published: checked })}
                />
                <Label htmlFor="route-published">Published</Label>
                {open.bundleId && (
                  <div className="ml-auto flex items-center gap-2">
                    {children.length > 0 ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button type="button" variant="ghost" size="sm">
                            Delete route and {children.length} child
                            {children.length === 1 ? "" : "ren"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete this route and its descendants?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes <strong>{open.name || open.pathSegment}</strong> and
                              every route beneath it — {descendants.size} route
                              {descendants.size === 1 ? "" : "s"} in total. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void removeSubtree()}>
                              Delete {descendants.size + 1} routes
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeRoute()}
                      >
                        Delete route
                      </Button>
                    )}
                  </div>
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
              <CardContent className="flex flex-col gap-3">
                {children.length > 0 && !treeHasOutletNow && (
                  <p
                    className={`rounded-[var(--radius)] border px-3 py-2 text-sm ${
                      hasPublishedChildren
                        ? "border-destructive/40 bg-destructive/5 text-destructive"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    This route has {children.length} child route
                    {children.length === 1 ? "" : "s"} but no outlet.{" "}
                    {hasPublishedChildren
                      ? "A published child renders inside it — add an outlet below."
                      : "Add an outlet below to nest them inside it."}
                  </p>
                )}
                <SectionTree
                  tree={open.tree}
                  selectedId={selectedNodeId}
                  hasChildRoutes={children.length > 0}
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
                {!selectedNode ? (
                  <p className="text-muted-foreground text-sm">
                    Select a section in the tree to edit its content.
                  </p>
                ) : selectedNode.sectionKey === OUTLET_SECTION_KEY ? (
                  <p className="text-muted-foreground text-sm">
                    The outlet has no content of its own — the matched child route renders here.
                  </p>
                ) : (
                  <SectionFieldForm
                    key={`${selectedNode.instanceId}:${contentLocale}`}
                    sectionKey={selectedNode.sectionKey}
                    locale={contentLocale}
                    fields={selectedNode.content[contentLocale] ?? {}}
                    onChange={editSelectedContent}
                  />
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
                params={open.params}
                onChange={(seo) => setOpen({ ...open, seo: { ...open.seo, [contentLocale]: seo } })}
              />
            </CardContent>
          </Card>

          <RoutePreview tree={open.tree} locale={contentLocale} />

          <PublishBar
            tree={open.tree}
            hasChildren={children.length > 0}
            hasPublishedChildren={hasPublishedChildren}
            parentHasOutlet={parentHasOutlet}
            paramNames={open.params.map((param) => param.name)}
            pending={pending}
            onSaveDraft={() => void save(false)}
            onPublish={() => void save(true)}
          />
        </div>
      )}
    </div>
  );
}

/** Absolute pattern -> its `:name` params, tolerating one still being edited. */
function safeParamNames(path: string): readonly string[] {
  try {
    return parseRoutePattern(path).paramNames;
  } catch {
    return [];
  }
}
