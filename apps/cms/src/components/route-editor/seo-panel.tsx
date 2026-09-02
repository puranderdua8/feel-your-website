import type { RouteSeo } from "@feel-your-website/content-core";
import { Input, Label, Textarea } from "@feel-your-website/ui";

/**
 * Edits one route's SEO metadata for one locale — a controlled form over
 * `seo`, saved with the route. Switching the header locale edits a different
 * `RouteSeo` on the same route.
 */
export function SeoPanel({
  locale,
  seo,
  onChange,
}: {
  locale: string;
  seo: RouteSeo;
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

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        Metadata for <code>{locale}</code>, injected into <code>&lt;head&gt;</code> for this route.
      </p>

      <Field id="seo-title" label="Title">
        <Input
          id="seo-title"
          value={seo.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>

      <Field id="seo-description" label="Description">
        <Textarea
          id="seo-description"
          value={seo.description ?? ""}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>

      <Field id="seo-canonical" label="Canonical URL">
        <Input
          id="seo-canonical"
          type="url"
          value={seo.canonical ?? ""}
          onChange={(e) => set({ canonical: e.target.value })}
        />
      </Field>

      <Field id="seo-og-image" label="OG image URL">
        <Input
          id="seo-og-image"
          type="url"
          value={seo.ogImage ?? ""}
          onChange={(e) => set({ ogImage: e.target.value })}
        />
      </Field>

      <Field id="seo-keywords" label="Keywords (comma-separated)">
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
      </Field>

      <Field id="seo-robots" label="Robots">
        <Input
          id="seo-robots"
          placeholder="index, follow"
          value={seo.robots ?? ""}
          onChange={(e) => set({ robots: e.target.value })}
        />
      </Field>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
