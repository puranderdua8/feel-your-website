import type { RouteParamSpec, RouteSeo } from "@feel-your-website/content-core";
import { templatePlaceholders } from "@feel-your-website/content-core";
import { Button, Input, Label, Textarea } from "@feel-your-website/ui";

type TemplatableField = "title" | "description" | "canonical" | "ogImage";

/**
 * Edits one route's SEO metadata for one locale — a controlled form over
 * `seo`, saved with the route. Switching the header locale edits a different
 * `RouteSeo` on the same route.
 *
 * When the route has parameters, each templatable field gets "insert" chips
 * (append `{{name}}`) and flags any `{{placeholder}}` that isn't one of this
 * route's actual parameters — the same check `validateRouteInput` blocks a
 * save on, surfaced inline instead of only on save.
 */
export function SeoPanel({
  locale,
  seo,
  params = [],
  onChange,
}: {
  locale: string;
  seo: RouteSeo;
  params?: readonly RouteParamSpec[];
  onChange: (seo: RouteSeo) => void;
}) {
  function set(patch: Partial<RouteSeo>) {
    // Drop keys that go empty, so an all-blank locale serialises to `{}`.
    const next: Record<string, unknown> = { ...seo, ...patch };
    for (const key of Object.keys(next)) {
      const value = next[key];
      if (value === "" || value === undefined || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      }
    }
    onChange(next as RouteSeo);
  }

  function insert(field: TemplatableField, name: string) {
    set({ [field]: `${seo[field] ?? ""}{{${name}}}` });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Metadata for <code>{locale}</code>, injected into <code>&lt;head&gt;</code> for this route.
        {params.length > 0 && " Use {{name}} to insert a parameter's value."}
      </p>

      <Field
        id="seo-title"
        label="Title"
        field="title"
        value={seo.title}
        params={params}
        onInsert={insert}
      >
        <Input
          id="seo-title"
          value={seo.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>

      <Field
        id="seo-description"
        label="Description"
        field="description"
        value={seo.description}
        params={params}
        onInsert={insert}
      >
        <Textarea
          id="seo-description"
          value={seo.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>

      <Field
        id="seo-canonical"
        label="Canonical URL"
        field="canonical"
        value={seo.canonical}
        params={params}
        onInsert={insert}
      >
        <Input
          id="seo-canonical"
          type="url"
          value={seo.canonical ?? ""}
          onChange={(e) => set({ canonical: e.target.value })}
        />
      </Field>

      <Field
        id="seo-og-image"
        label="OG image URL"
        field="ogImage"
        value={seo.ogImage}
        params={params}
        onInsert={insert}
      >
        <Input
          id="seo-og-image"
          type="url"
          value={seo.ogImage ?? ""}
          onChange={(e) => set({ ogImage: e.target.value })}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seo-keywords">Keywords (comma-separated)</Label>
        <Input
          id="seo-keywords"
          value={(seo.keywords ?? []).join(", ")}
          onChange={(e) =>
            set({
              keywords: e.target.value
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean),
            })
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="seo-robots">Robots</Label>
        <Input
          id="seo-robots"
          placeholder="index, follow"
          value={seo.robots ?? ""}
          onChange={(e) => set({ robots: e.target.value })}
        />
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  field,
  value,
  params,
  onInsert,
  children,
}: {
  id: string;
  label: string;
  field: TemplatableField;
  value?: string;
  params: readonly RouteParamSpec[];
  onInsert: (field: TemplatableField, name: string) => void;
  children: React.ReactNode;
}) {
  const unknown = value
    ? templatePlaceholders(value).filter((name) => !params.some((p) => p.name === name))
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {params.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {params.map((p) => (
            <Button
              key={p.name}
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 font-mono text-xs"
              onClick={() => onInsert(field, p.name)}
            >
              +{"{{"}
              {p.name}
              {"}}"}
            </Button>
          ))}
          {unknown.length > 0 && (
            <span className="text-destructive text-xs">
              unknown: {unknown.map((n) => `{{${n}}}`).join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
