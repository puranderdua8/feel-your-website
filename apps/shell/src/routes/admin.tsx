import { Can } from "@feel-your-website/rbac/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@feel-your-website/ui";
import { createFileRoute } from "@tanstack/react-router";

import { LockedBanner } from "@/components/locked-banner";

export const Route = createFileRoute("/admin")({
  component: Admin,
});

/**
 * A permission-gated route, proving the RBAC seam end to end.
 *
 * The mock provider starts signed out, so this renders the locked banner. It
 * is worth being explicit about what this gate is and is not: hiding the
 * panel is a *display* decision. The endpoint behind it must refuse the
 * request independently — a hidden button protects nothing.
 */
function Admin() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <Can permission="manage:content" fallback={<LockedBanner />}>
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Visible only with the manage:content permission.</CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </Can>
    </main>
  );
}
