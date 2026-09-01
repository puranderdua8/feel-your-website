import type { ConfigBundle } from "@feel-your-website/config-schema";
import { Can } from "@feel-your-website/rbac/react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@feel-your-website/ui";
import { useEffect, useState, type FormEvent } from "react";

import { templateCatalog } from "@/content/template-keys";
import { deleteRouteBundle, listRouteBundles, saveRouteBundle } from "@/server/bff";

import { LockedNotice } from "./locked-notice.js";

export function RouteBundlesPanel({ actor }: { actor: string }) {
  return (
    <Can permission="manage:routes" fallback={<LockedNotice permission="manage:routes" />}>
      <RouteBundleEditor actor={actor} />
    </Can>
  );
}

function RouteBundleEditor({ actor }: { actor: string }) {
  const [bundles, setBundles] = useState<readonly ConfigBundle[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [path, setPath] = useState("/");
  const [published, setPublished] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setBundles(await listRouteBundles());
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startEdit(bundle: ConfigBundle) {
    setEditingId(bundle.id);
    setEditingVersion(bundle.version);
    setName(bundle.name);
    setPath(bundle.path ?? "/");
    setPublished(bundle.published ?? false);
    setSelected([...bundle.items]);
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setEditingVersion(null);
    setName("");
    setPath("/");
    setPublished(false);
    setSelected([]);
    setError(null);
  }

  function toggle(key: string) {
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function move(index: number, delta: number) {
    setSelected((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target] as string, next[index] as string];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await saveRouteBundle({
        data: {
          id: editingId ?? undefined,
          name,
          path,
          items: selected,
          published,
          expectedVersion: editingVersion ?? undefined,
          actor,
        },
      });
      startNew();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function remove(bundle: ConfigBundle) {
    await deleteRouteBundle({ data: { id: bundle.id, expectedVersion: bundle.version, actor } });
    if (editingId === bundle.id) startNew();
    await refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Route bundles</CardTitle>
        <CardDescription>
          Which templates render at a path, in order. Only published bundles reach{" "}
          <code>getRouteManifest()</code> — see <code>published_route_manifest</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {bundles.length === 0 && (
            <li className="text-muted-foreground text-sm">No route bundles yet.</li>
          )}
          {bundles.map((bundle) => (
            <li
              key={bundle.id}
              className="border-border flex items-start justify-between gap-4 rounded-[var(--radius)] border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {bundle.name} <span className="text-muted-foreground">· v{bundle.version}</span>{" "}
                  {bundle.published ? (
                    <span className="text-emerald-600">published</span>
                  ) : (
                    <span className="text-muted-foreground">draft</span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {bundle.path} — {bundle.items.join(" → ") || "empty"}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(bundle)}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => void remove(bundle)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form className="flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-name">Name</Label>
              <Input
                id="route-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="route-path">Path</Label>
              <Input
                id="route-path"
                required
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
            </div>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">Templates</legend>
            {templateCatalog.definitions.map((template) => (
              <label key={template.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(template.name)}
                  onChange={() => toggle(template.name)}
                />
                <span>
                  {template.name}{" "}
                  <span className="text-muted-foreground">— {template.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {selected.length > 1 && (
            <ol className="flex flex-col gap-1">
              <p className="text-sm font-medium">Render order</p>
              {selected.map((key, index) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-6">{index + 1}.</span>
                  <span className="flex-1">{key}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(index, -1)}>
                    ↑
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => move(index, 1)}>
                    ↓
                  </Button>
                </li>
              ))}
            </ol>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Published — visible to `getRouteManifest()`
          </label>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {editingId ? "Save changes" : "Create route bundle"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={startNew}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
