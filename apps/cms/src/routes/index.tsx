import { PermissionsProvider } from "@feel-your-website/rbac/react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@feel-your-website/ui";
import { createFileRoute, useRouter } from "@tanstack/react-router";

import { ContentPanel } from "@/components/content-panel";
import { RolesPanel } from "@/components/roles-panel";
import { RouteBundlesPanel } from "@/components/route-bundles-panel";
import { SignInForm } from "@/components/sign-in-form";
import { loadSession, signOut, type SessionPayload } from "@/server/bff";

export const Route = createFileRoute("/")({
  loader: async (): Promise<SessionPayload> => loadSession(),
  component: CmsHome,
});

/**
 * One route holding three authoring surfaces as tabs, rather than three
 * routes. There is no navigation this app needs a URL for yet — nobody
 * bookmarks "the roles tab" — and a single loader means one round trip for
 * the session that gates all three, not three.
 */
function CmsHome() {
  const session = Route.useLoaderData();
  const router = useRouter();

  if (!session.userId) {
    return <SignInForm onSignedIn={() => void router.invalidate()} />;
  }

  return (
    <PermissionsProvider permissions={new Set(session.permissions)}>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">CMS</h1>
            <p className="text-muted-foreground text-sm">{session.email}</p>
          </div>
          <Button variant="outline" onClick={() => void signOut().then(() => router.invalidate())}>
            Sign out
          </Button>
        </header>

        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="routes">Routes</TabsTrigger>
          </TabsList>
          <TabsContent value="content">
            <ContentPanel />
          </TabsContent>
          <TabsContent value="roles">
            <RolesPanel actor={session.userId} />
          </TabsContent>
          <TabsContent value="routes">
            <RouteBundlesPanel actor={session.userId} />
          </TabsContent>
        </Tabs>
      </main>
    </PermissionsProvider>
  );
}
