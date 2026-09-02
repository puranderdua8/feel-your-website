import type { Content, JsonValue } from "@feel-your-website/content-core";
import { validateSectionFields } from "@feel-your-website/content-core";
import { Button } from "@feel-your-website/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sectionCatalog } from "@/content/sections";
import { getSectionContent, saveContentItem } from "@/server/bff";

import { FieldControl } from "../field-control.js";

/**
 * Edits the *global* content of the selected node's section, at the active
 * content locale — the same schema-driven form the Sections tab uses. Every
 * keystroke is pushed up via `onEdit` so the live preview re-renders; `Save`
 * persists it and reports the saved row back.
 */
export function SectionFieldForm({
  sectionKey,
  variant,
  locale,
  onEdit,
  onSaved,
}: {
  sectionKey: string;
  variant: string;
  locale: string;
  onEdit: (fields: Readonly<Record<string, JsonValue>>) => void;
  onSaved: (content: Content) => void;
}) {
  const def = sectionCatalog.byKey.get(sectionKey);
  const [fields, setFields] = useState<Record<string, JsonValue>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `onEdit` is a fresh closure each parent render; a ref keeps the effect
  // below keyed only on `fields`, and never fires a parent update mid-render.
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await getSectionContent({ data: { key: sectionKey, variant, locale } });
      setFields(content ? { ...content.fields } : {});
    } finally {
      setLoading(false);
    }
  }, [sectionKey, variant, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  // Push every field change up for the live preview, out of render.
  useEffect(() => {
    onEditRef.current(fields);
  }, [fields]);

  const issues = useMemo(() => (def ? validateSectionFields(def, fields) : []), [def, fields]);

  function setField(name: string, value: JsonValue) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const saved = await saveContentItem({
        data: { templateKey: sectionKey, locale, fields, variant },
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  if (!def) return <p className="text-destructive text-sm">Unknown section “{sectionKey}”.</p>;
  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Editing <code>{sectionKey}</code>
        {variant && (
          <>
            {" · "}
            <code>{variant}</code>
          </>
        )}{" "}
        content in <code>{locale}</code>. This is global — it changes everywhere the section is
        used.
      </p>

      {def.fields.map((spec) => (
        <FieldControl
          key={spec.name}
          spec={spec}
          idPrefix="route-field"
          value={fields[spec.name]}
          onChange={(value) => setField(spec.name, value)}
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
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="button" disabled={pending} onClick={() => void handleSave()}>
        Save content
      </Button>
    </div>
  );
}
