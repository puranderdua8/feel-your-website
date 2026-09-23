import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@feel-your-website/ui";
import { useMatches } from "@tanstack/react-router";
import { Fragment } from "react";

import type { RouteContent } from "@/server/bff";

/** Narrows a match's `loaderData` to a resolved CMS bundle — every `(cms)/**` layout/leaf's shape. */
function isRouteContent(data: unknown): data is RouteContent {
  return (
    typeof data === "object" &&
    data !== null &&
    "routeKey" in data &&
    "seo" in data &&
    "path" in data
  );
}

/**
 * A breadcrumb label for a bundle whose SEO title is unset: the pattern's
 * last segment — but resolved to the request's actual value when that
 * segment is a `:param`, never the raw `:name` token, which no visitor could
 * read. `/` falls back to `"home"`.
 */
function fallbackTitle(pattern: string, params: Readonly<Record<string, string>>): string {
  const last = pattern.split("/").filter(Boolean).at(-1);
  if (!last) return "home";
  return last.startsWith(":") ? params[last.slice(1)] || last.slice(1) : last;
}

/**
 * The breadcrumb trail for a nested CMS route, from the outermost bundle down
 * to the current page. Built from `useMatches()` rather than a server-side
 * chain: each match's own `loaderData` is a resolved `RouteContent` when that
 * match is a CMS layout or leaf with its own bundle, and absent otherwise — a
 * non-CMS route, or the exact-index half of a layout pair (which renders
 * nothing and needs no crumb of its own; the layout beside it already
 * supplies one for that level). Rendered only when there's more than one
 * entry, so a top-level route shows nothing.
 */
export function Breadcrumbs(): React.JSX.Element | null {
  const matches = useMatches();
  const entries = matches
    .filter((match) => isRouteContent(match.loaderData))
    .map((match) => {
      const content = match.loaderData as RouteContent;
      return {
        id: match.id,
        href: match.pathname,
        title: content.seo.title || fallbackTitle(content.path, content.params),
      };
    });

  if (entries.length < 2) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {entries.map((entry, i) => {
          const isCurrent = i === entries.length - 1;
          return (
            <Fragment key={entry.id}>
              <BreadcrumbItem>
                {isCurrent ? (
                  <BreadcrumbPage>{entry.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <a href={entry.href}>{entry.title}</a>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isCurrent && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
