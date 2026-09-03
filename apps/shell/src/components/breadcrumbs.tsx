import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@feel-your-website/ui";

import type { RouteChainEntry } from "@/server/bff";

/**
 * The breadcrumb trail for a nested route, from the root layout down to the
 * current page. Rendered only when the chain has more than one entry, so a
 * top-level route shows nothing. Plain `<a href>` — the shell is content pages,
 * and every path is server-rendered by the `/$` route anyway.
 */
export function Breadcrumbs({ chain }: { chain: readonly RouteChainEntry[] }) {
  if (chain.length < 2) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {chain.map((entry, i) => {
          const isCurrent = i === chain.length - 1;
          return (
            <BreadcrumbItem key={entry.id}>
              {isCurrent ? (
                <BreadcrumbPage>{entry.title}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild>
                    <a href={entry.href}>{entry.title}</a>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
