import type { RouteCompositionSummary } from "@feel-your-website/content-core";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-your-website/ui";

import { descendantIds, walkForest, buildRouteForest } from "./route-hierarchy.js";

const TOP_LEVEL = "__top_level__";

/**
 * Picks this route's parent, or none (top level). Excludes the route itself
 * and every one of its descendants — reparenting under your own child would
 * create a cycle `save_route_composition` would refuse anyway, but catching it
 * here means the option never even appears.
 */
export function ParentPicker({
  routes,
  selfId,
  value,
  onChange,
}: {
  routes: readonly RouteCompositionSummary[];
  /** `null` for a route that hasn't been saved yet — nothing to exclude. */
  selfId: string | null;
  value: string | null;
  onChange: (parentId: string | null) => void;
}) {
  const excluded = selfId ? new Set([selfId, ...descendantIds(selfId, routes)]) : new Set<string>();
  const forest = buildRouteForest(routes);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="route-parent">Parent route</Label>
      <Select
        value={value ?? TOP_LEVEL}
        onValueChange={(next) => onChange(next === TOP_LEVEL ? null : next)}
      >
        <SelectTrigger id="route-parent" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TOP_LEVEL}>— top level —</SelectItem>
          {[...walkForest(forest)]
            .filter(({ node }) => !excluded.has(node.summary.id))
            .map(({ node, depth }) => (
              <SelectItem key={node.summary.id} value={node.summary.id}>
                {"  ".repeat(depth)}
                {depth > 0 && "↳ "}
                {node.summary.name} · {node.summary.path}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
