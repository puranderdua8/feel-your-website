import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@feel-your-website/ui";

/**
 * What a guarded panel renders when the permission is absent — same
 * reasoning as `apps/shell`'s `LockedBanner`: an explanation, not a redirect
 * or a missing tab. This is a *display* decision; every server function
 * behind it refuses independently (the RPCs' own `has_permission()` checks,
 * or `MemoryConfigBundleStore`'s lack of any real backend to protect in mock
 * mode) — see `Can`'s own doc in `@feel-your-website/rbac/react`.
 */
export function LockedNotice({ permission }: { permission: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Not available to you</CardTitle>
        <CardDescription>
          This needs the <code>{permission}</code> permission. Ask someone who holds{" "}
          <code>manage:roles</code> to grant it.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
