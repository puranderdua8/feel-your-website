import { PermissionsProvider } from "@feel-your-website/rbac/react";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@feel-your-website/ui";
import { createFileRoute, useRouter } from "@tanstack/react-router";

import { ContentPanel } from "@/components/content-panel";
import { RolesPanel } from "@/components/roles-panel";
import { RouteBundlesPanel } from "@/components/route-bundles-panel";
import { SectionsPanel } from "@/components/sections-panel";
import { SignInForm } from "@/components/sign-in-form";
import { ContentLocaleProvider, useContentLocale } from "@/i18n/content-locale";
import { loadSession, signOut, type SessionPayload } from "@/server/bff";

export const Route = createFileRoute("/")({
  loader: async (): Promise<SessionPayload> => loadSession(),
  component: CmsHome,
});

/**
 * One route holding the authoring surfaces as tabs, rather than one route
 * each. There is no navigation this app needs a URL for yet — nobody
 * bookmarks "the roles tab" — and a single loader means one round trip for
 * the session that gates them all.
 */
function CmsHome() {
  const session = Route.useLoaderData();
  const router = useRouter();

  if (!session.userId) {
    return <SignInForm onSignedIn={() => void router.invalidate()} />;
  }

  return (
    <PermissionsProvider permissions={new Set(session.permissions)}>
      <ContentLocaleProvider>
        <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">CMS</h1>
              <p className="text-muted-foreground text-sm">{session.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <ContentLocaleSelect />
              <Button
                variant="outline"
                onClick={() => void signOut().then(() => router.invalidate())}
              >
                Sign out
              </Button>
            </div>
          </header>

          <Tabs defaultValue="sections">
            <TabsList>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
            </TabsList>
            <TabsContent value="sections">
              <SectionsPanel />
            </TabsContent>
            <TabsContent value="routes">
              <RouteBundlesPanel actor={session.userId} />
            </TabsContent>
            <TabsContent value="content">
              <ContentPanel />
            </TabsContent>
            <TabsContent value="roles">
              <RolesPanel actor={session.userId} />
            </TabsContent>
          </Tabs>
        </main>
      </ContentLocaleProvider>
    </PermissionsProvider>
  );
}

/** The global content-language switcher — every authoring surface reads it. */
function ContentLocaleSelect() {
  const { locales, contentLocale, setContentLocale } = useContentLocale();

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">Language</span>
      <Select value={contentLocale} onValueChange={setContentLocale}>
        <SelectTrigger className="w-36" aria-label="Content language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale.locale} value={locale.locale}>
              {locale.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
