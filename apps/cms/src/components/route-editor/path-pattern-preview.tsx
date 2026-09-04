import type {
  RouteCompositionSummary,
  RouteParamSpec,
  RouteSeo,
} from "@feel-your-website/content-core";
import { buildHref } from "@feel-your-website/content-core";
import { Badge, Input, Label } from "@feel-your-website/ui";
import { useState } from "react";

import { composeCandidatePath, validateRouteInput } from "@/server/route-input";

/**
 * Live feedback while authoring a route: the composed absolute pattern, a
 * sample concrete URL (fill in one value per parameter), and every issue
 * `validateRouteInput` — the same function the save-time check runs — would
 * raise right now. No round trip: `route-input.ts` is pure.
 */
export function PathPatternPreview({
  bundleId,
  parentId,
  pathSegment,
  params,
  published,
  seo,
  siblings,
}: {
  bundleId: string | null;
  parentId: string | null;
  pathSegment: string;
  params: readonly RouteParamSpec[];
  published: boolean;
  seo: Readonly<Record<string, RouteSeo>>;
  siblings: readonly RouteCompositionSummary[];
}) {
  const [samples, setSamples] = useState<Record<string, string>>({});

  const path = composeCandidatePath({ parentId, pathSegment, siblings });
  const issues = validateRouteInput({
    bundleId,
    parentId,
    pathSegment,
    params,
    published,
    seo,
    siblings,
  });

  const sampleUrl =
    path && params.every((p) => samples[p.name]?.trim())
      ? tryBuildHref(path, params, samples)
      : null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Pattern:</span>
        <code className="bg-muted rounded px-1.5 py-0.5">{path ?? "(invalid)"}</code>
        {path && params.length === 0 && <Badge variant="secondary">static</Badge>}
        {path && params.length > 0 && <Badge variant="secondary">parameterised</Badge>}
      </div>

      {params.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          {params.map((p) => (
            <div key={p.name} className="flex flex-col gap-1">
              <Label htmlFor={`sample-${p.name}`} className="text-muted-foreground text-xs">
                Sample :{p.name}
              </Label>
              <Input
                id={`sample-${p.name}`}
                className="h-7 w-28 text-xs"
                value={samples[p.name] ?? ""}
                onChange={(e) => setSamples((s) => ({ ...s, [p.name]: e.target.value }))}
              />
            </div>
          ))}
          {sampleUrl && (
            <p className="text-muted-foreground text-xs">
              e.g. <code>{sampleUrl}</code>
            </p>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <ul className="text-destructive flex flex-col gap-0.5 text-xs">
          {issues.map((issue, i) => (
            <li key={i}>{issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function tryBuildHref(
  path: string,
  params: readonly RouteParamSpec[],
  samples: Record<string, string>,
): string | null {
  try {
    return buildHref(path, Object.fromEntries(params.map((p) => [p.name, samples[p.name] ?? ""])));
  } catch {
    return null;
  }
}
