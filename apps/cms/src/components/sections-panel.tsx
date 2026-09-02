import type { SectionDefinition } from "@feel-your-website/content-core";
import { Can } from "@feel-your-website/rbac/react";
import { renderSectionSample } from "@feel-your-website/section-registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@feel-your-website/ui";
import { ThemeProvider } from "@feel-your-website/theme/client";

import { sectionCatalog } from "@/content/sections";

import { LockedNotice } from "./locked-notice.js";

/**
 * The Sections surface: a read-only gallery of every section in the
 * code-defined catalog, each rendered with the placeholder content from its
 * `SectionDefinition.sample`, beside its field and slot schema.
 *
 * There is nothing to edit here. A section is a reusable component — a
 * container for whatever a route hands it — not a place content lives. The
 * content for a section on a page is authored in the Routes tab, against that
 * route. This tab exists so an author can see what each component looks like
 * before placing it.
 */
export function SectionsPanel() {
  return (
    <Can permission="manage:content" fallback={<LockedNotice permission="manage:content" />}>
      <SectionsGallery />
    </Can>
  );
}

function SectionsGallery() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Sections are reusable components. They render whatever content a route feeds them — the
        previews below use placeholder data. Author real content in the Routes tab.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {sectionCatalog.definitions.map((def) => (
          <SectionCard key={def.key} def={def} />
        ))}
      </div>
    </div>
  );
}

function SectionCard({ def }: { def: SectionDefinition }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-base">{def.key}</CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="border-border overflow-hidden rounded-[var(--radius)] border">
          <p className="bg-muted text-muted-foreground border-border border-b px-3 py-1.5 text-xs">
            Preview · placeholder content
          </p>
          <ThemeProvider theme="base">
            <div className="bg-background flex flex-col gap-4 p-4">{renderSectionSample(def)}</div>
          </ThemeProvider>
        </div>

        <SchemaTable def={def} />
      </CardContent>
    </Card>
  );
}

function SchemaTable({ def }: { def: SectionDefinition }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
          Fields
        </p>
        {def.fields.length === 0 ? (
          <p className="text-muted-foreground">No fields.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {def.fields.map((field) => (
              <li key={field.name} className="flex flex-wrap items-baseline gap-x-2">
                <code>{field.name}</code>
                <span className="text-muted-foreground">
                  {field.label} · {field.type}
                  {field.required && <span className="text-destructive"> · required</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {def.slots.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wide">
            Slots
          </p>
          <ul className="flex flex-col gap-0.5">
            {def.slots.map((slot) => (
              <li key={slot.name} className="flex flex-wrap items-baseline gap-x-2">
                <code>{slot.name}</code>
                <span className="text-muted-foreground">
                  {slot.label} · {slot.arity}
                  {slot.accepts.length > 0 && ` · accepts ${slot.accepts.join(" / ")}`}
                  {slot.required && <span className="text-destructive"> · required</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
