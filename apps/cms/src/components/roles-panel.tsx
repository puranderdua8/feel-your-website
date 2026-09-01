import type { ConfigBundle } from "@feel-your-website/config-schema";
import { PLATFORM_PERMISSIONS, SEED_ONLY_PERMISSIONS } from "@feel-your-website/rbac";
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

import { deleteRoleBundle, listRoleBundles, saveRoleBundle } from "@/server/bff";

import { LockedNotice } from "./locked-notice.js";

/**
 * Assignable permissions, in the role editor's own sense: the platform
 * catalog minus `SEED_ONLY_PERMISSIONS` (`manage:roles` — see that
 * constant's own doc on why it is never offered here). The server enforces
 * the same exclusion independently (`SupabaseConfigBundleStore`'s
 * `forbiddenItems`, or the fixed set `MockAuthProvider`'s accounts already
 * carry in mock mode) — this is only what the form *shows*.
 */
const ASSIGNABLE_PERMISSIONS = PLATFORM_PERMISSIONS.filter(
  (permission) => !SEED_ONLY_PERMISSIONS.includes(permission.name),
);

export function RolesPanel({ actor }: { actor: string }) {
  return (
    <Can permission="manage:roles" fallback={<LockedNotice permission="manage:roles" />}>
      <RoleEditor actor={actor} />
    </Can>
  );
}

function RoleEditor({ actor }: { actor: string }) {
  const [bundles, setBundles] = useState<readonly ConfigBundle[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setBundles(await listRoleBundles());
  }

  useEffect(() => {
    void refresh();
  }, []);

  function startEdit(bundle: ConfigBundle) {
    setEditingId(bundle.id);
    setEditingVersion(bundle.version);
    setName(bundle.name);
    setSelected(new Set(bundle.items));
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setEditingVersion(null);
    setName("");
    setSelected(new Set());
    setError(null);
  }

  function toggle(permission: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await saveRoleBundle({
        data: {
          id: editingId ?? undefined,
          name,
          items: [...selected],
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
    await deleteRoleBundle({ data: { id: bundle.id, expectedVersion: bundle.version, actor } });
    if (editingId === bundle.id) startNew();
    await refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>
          A role is a named set of permissions. Two editors saving the same role is expected — a
          stale save is refused, not silently overwritten.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {bundles.length === 0 && <li className="text-muted-foreground text-sm">No roles yet.</li>}
          {bundles.map((bundle) => (
            <li
              key={bundle.id}
              className="border-border flex items-start justify-between gap-4 rounded-[var(--radius)] border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {bundle.name} <span className="text-muted-foreground">· v{bundle.version}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  {bundle.items.join(", ") || "no permissions"}
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">Permissions</legend>
            {ASSIGNABLE_PERMISSIONS.map((permission) => (
              <label key={permission.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(permission.name)}
                  onChange={() => toggle(permission.name)}
                />
                <span>
                  {permission.name}{" "}
                  <span className="text-muted-foreground">— {permission.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {editingId ? "Save changes" : "Create role"}
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
