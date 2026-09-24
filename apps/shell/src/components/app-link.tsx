import type { InternalRoute } from "@feel-your-website/section-registry";
import { Link, useRouter } from "@tanstack/react-router";
import type { ComponentProps } from "react";

type AnchorProps = Omit<ComponentProps<"a">, "href">;

export type AppLinkProps = AnchorProps &
  (
    | {
        /** A plain in-app path with no query or fragment (a nav or breadcrumb entry). */
        readonly to: string;
        readonly route?: never;
      }
    | {
        /** A CMS-authored internal link, pre-split by `classifyHref`. */
        readonly route: InternalRoute;
        readonly to?: never;
      }
  );

/**
 * TanStack `<Link>` for a path only known at runtime — a CMS route, nav
 * entry, or breadcrumb — so every in-app link gets the router's client-side
 * transition, `defaultPreload: "intent"`, and active-link state.
 *
 * A query string is parsed with this router's own `parseSearch`, so the
 * rendered `href` round-trips to exactly what was authored (the default
 * serializer would otherwise JSON-quote a numeric-looking string).
 *
 * Extra anchor props (and, on React 19, `ref`) pass through, so a Radix
 * `asChild` wrapper (`NavigationMenuLink`, `BreadcrumbLink`) can compose onto it.
 */
export function AppLink({ to, route, ...anchorProps }: AppLinkProps): React.JSX.Element {
  const router = useRouter();
  const pathname = route ? route.pathname : to;
  const search = route?.search ? router.options.parseSearch(route.search) : undefined;
  const hash = route?.hash || undefined;

  return (
    <Link
      {...anchorProps}
      // The one widening point: these paths are runtime strings, not route
      // literals the router can check at compile time.
      to={pathname as string}
      search={search as never}
      hash={hash}
    />
  );
}
