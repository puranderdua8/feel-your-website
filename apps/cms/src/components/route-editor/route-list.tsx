import type { RouteCompositionSummary } from "@feel-your-website/content-core";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@feel-your-website/ui";

/**
 * The left rail: every route, plus "New". Selection drives the editor on the
 * right. Reads header rows only — a list needs no tree.
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
  return (
    <Card className="sm:w-64 sm:shrink-0">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Routes</CardTitle>
        <Button size="sm" variant="outline" onClick={onNew}>
          New
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {routes.length === 0 && <p className="text-muted-foreground text-sm">No routes yet.</p>}
        {routes.map((route) => (
          <button
            key={route.id}
            type="button"
            onClick={() => onSelect(route.id)}
            className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              route.id === selectedId ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
            }`}
          >
            <span className="font-medium">{route.name}</span>
            <span className="text-muted-foreground block text-xs">
              {route.path} · {route.published ? "published" : "draft"}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
