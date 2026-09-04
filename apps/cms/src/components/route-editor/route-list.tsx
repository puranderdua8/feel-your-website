import type { RouteCompositionSummary } from "@feel-your-website/content-core";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@feel-your-website/ui";

import { buildRouteForest, walkForest } from "./route-hierarchy.js";

/**
 * The left rail: every route as a hierarchy, plus "New". Selection drives the
 * editor on the right. Reads header rows only — a list needs no tree.
 */
export function RouteList({
  routes,
  selectedId,
  onSelect,
  onNew,
}: {
  routes: readonly RouteCompositionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const forest = buildRouteForest(routes);

  return (
    <Card className="sm:w-72 sm:shrink-0">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Routes</CardTitle>
        <Button size="sm" variant="outline" onClick={onNew}>
          New
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {routes.length === 0 && <p className="text-muted-foreground text-sm">No routes yet.</p>}
        {[...walkForest(forest)].map(({ node: { summary }, depth }) => (
          <button
            key={summary.id}
            type="button"
            onClick={() => onSelect(summary.id)}
            style={{ marginLeft: depth * 14 }}
            className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              summary.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="font-medium">{summary.name}</span>
              {summary.path.includes(":") && (
                <Badge variant="outline" className="text-[10px]">
                  param
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground block text-xs">
              {summary.path} · {summary.published ? "published" : "draft"}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
