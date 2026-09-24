import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@feel-your-website/ui";

import { AppLink } from "@/components/app-link";
import type { NavNode } from "@/server/bff";

/**
 * The site navigation, built from the published-route forest (`bootstrap.nav`).
 * Two visible levels: top-level routes as links, a route with children as a
 * dropdown of itself + its descendants (deeper nesting is flattened into that
 * one list). Param routes never appear — they have no single URL. Every entry
 * is a TanStack `<Link>` (via `AppLink`): each CMS route is a real file route,
 * so a click is a client-side transition, hovering preloads it, and the
 * current page's link is marked `aria-current="page"`.
 */
export function SiteNav({ nav }: { nav: readonly NavNode[] }) {
  if (nav.length === 0) return null;

  return (
    <NavigationMenu className="border-border border-b px-8 py-2" viewport={false}>
      <NavigationMenuList>
        {nav.map((node) =>
          node.children.length === 0 ? (
            <NavigationMenuItem key={node.id}>
              <NavigationMenuLink asChild>
                <AppLink to={node.path}>{node.title}</AppLink>
              </NavigationMenuLink>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={node.id}>
              <NavigationMenuTrigger>{node.title}</NavigationMenuTrigger>
              <NavigationMenuContent className="flex min-w-40 flex-col">
                <NavigationMenuLink asChild>
                  <AppLink to={node.path}>{node.title}</AppLink>
                </NavigationMenuLink>
                {flatten(node.children).map((child) => (
                  <NavigationMenuLink key={child.id} asChild>
                    <AppLink to={child.path}>{child.title}</AppLink>
                  </NavigationMenuLink>
                ))}
              </NavigationMenuContent>
            </NavigationMenuItem>
          ),
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

/** Pre-order flatten of a node's descendants. */
function flatten(nodes: readonly NavNode[]): NavNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
