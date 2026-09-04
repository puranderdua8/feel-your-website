import type { RouteParamSpec } from "@feel-your-website/content-core";
import { Input, Label } from "@feel-your-website/ui";

/**
 * One row per `:name` token the path actually contains — `paramNames` is the
 * source of truth (from parsing the composed pattern), `params` only supplies
 * labels. A name whose token has since been removed from the path silently
 * drops out; a newly-added name gets an empty label until the author fills it
 * in (and `validateRouteInput` blocks saving until they do).
 */
export function ParamEditor({
  paramNames,
  params,
  onChange,
}: {
  paramNames: readonly string[];
  params: readonly RouteParamSpec[];
  onChange: (params: RouteParamSpec[]) => void;
}) {
  if (paramNames.length === 0) return null;

  const labelOf = (name: string) => params.find((p) => p.name === name)?.label ?? "";

  function setLabel(name: string, label: string) {
    onChange(paramNames.map((n) => ({ name: n, label: n === name ? label : labelOf(n) })));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs font-medium uppercase">Parameters</p>
      {paramNames.map((name) => (
        <div key={name} className="grid grid-cols-[auto_1fr] items-center gap-2">
          <Label htmlFor={`param-${name}`} className="font-mono text-sm">
            :{name}
          </Label>
          <Input
            id={`param-${name}`}
            placeholder="Label shown to authors"
            value={labelOf(name)}
            onChange={(e) => setLabel(name, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
