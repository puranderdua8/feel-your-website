import type { JsonValue } from "@feel-your-website/content-core";
import { validateSectionFields } from "@feel-your-website/content-core";
import { useMemo } from "react";

import { sectionCatalog } from "@/content/sections";

import { FieldControl } from "../field-control.js";

/**
 * Edits one section instance's content for one locale — a controlled form
 * over `fields`, with no save of its own. The route editor owns the tree;
 * every keystroke is pushed up via `onChange` and persisted when the route
 * is saved. Switching locale in the header edits a different bag on the same
 * node.
 */
export function SectionFieldForm({
  sectionKey,
  locale,
  fields,
  onChange,
}: {
  sectionKey: string;
  locale: string;
  fields: Readonly<Record<string, JsonValue>>;
  onChange: (fields: Record<string, JsonValue>) => void;
}) {
  const def = sectionCatalog.byKey.get(sectionKey);
  const issues = useMemo(() => (def ? validateSectionFields(def, fields) : []), [def, fields]);

  if (!def) return <p className="text-destructive text-sm">Unknown section “{sectionKey}”.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Editing <code>{sectionKey}</code> content in <code>{locale}</code>. This belongs to this
        instance on this route — nowhere else.
      </p>

      {def.fields.map((spec) => (
        <FieldControl
          key={spec.name}
          spec={spec}
          idPrefix="route-field"
          value={fields[spec.name]}
          onChange={(value) => onChange({ ...fields, [spec.name]: value })}
        />
      ))}
      {def.fields.length === 0 && (
        <p className="text-muted-foreground text-sm">This section has no fields.</p>
      )}

      {issues.length > 0 && (
        <ul className="text-destructive text-sm">
          {issues.map((issue) => (
            <li key={issue.field}>{issue.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
