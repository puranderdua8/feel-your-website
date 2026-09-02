import type { JsonValue, SectionDefinition } from "@feel-your-website/content-core";
import { validateSectionFields } from "@feel-your-website/content-core";
import { Can } from "@feel-your-website/rbac/react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@feel-your-website/ui";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { sectionCatalog } from "@/content/sections";
import { useContentLocale } from "@/i18n/content-locale";
import { deleteContentItem, getSectionContent, saveContentItem } from "@/server/bff";

import { FieldControl } from "./field-control.js";
import { LockedNotice } from "./locked-notice.js";

/**
 * The Sections surface: pick a section from the code-defined catalog, then
 * edit one of its content variants with a form built from the section's
 * field schema — no JSON textarea. The variant and the active content locale
 * together identify which `content_items` row is being edited.
 */
export function SectionsPanel() {
  return (
    <Can permission="manage:content" fallback={<LockedNotice permission="manage:content" />}>
      <SectionsEditor />
    </Can>
  );
}

function SectionsEditor() {
  const { contentLocale } = useContentLocale();
  const [selectedKey, setSelectedKey] = useState(sectionCatalog.definitions[0]?.key ?? "");
  const [variant, setVariant] = useState("");

  const def = sectionCatalog.byKey.get(selectedKey);

  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <Card className="sm:w-64 sm:shrink-0">
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>The vocabulary a route may compose from.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {sectionCatalog.definitions.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => {
                setSelectedKey(section.key);
                setVariant("");
              }}
              className={`rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                section.key === selectedKey
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              }`}
            >
              <span className="font-medium">{section.key}</span>
              <span className="text-muted-foreground block text-xs">{section.description}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      {def && (
        <SectionForm
          key={`${def.key}:${variant}:${contentLocale}`}
          def={def}
          variant={variant}
          onVariantChange={setVariant}
          locale={contentLocale}
        />
      )}
    </div>
  );
}

function SectionForm({
  def,
  variant,
  onVariantChange,
  locale,
}: {
  def: SectionDefinition;
  variant: string;
  onVariantChange: (v: string) => void;
  locale: string;
}) {
  const [fields, setFields] = useState<Record<string, JsonValue>>({});
  const [variantDraft, setVariantDraft] = useState(variant);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const content = await getSectionContent({ data: { key: def.key, variant, locale } });
      setFields(content ? { ...content.fields } : {});
    } finally {
      setLoading(false);
    }
  }, [def.key, variant, locale]);

  useEffect(() => {
    setVariantDraft(variant);
    void load();
  }, [load, variant]);

  const issues = useMemo(() => validateSectionFields(def, fields), [def, fields]);

  function setField(name: string, value: JsonValue) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await saveContentItem({ data: { templateKey: def.key, locale, fields, variant } });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    setPending(true);
    try {
      await deleteContentItem({ data: { templateKey: def.key, locale, variant } });
      setFields({});
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {def.key}
          {variant && <span className="text-muted-foreground"> · {variant}</span>}
        </CardTitle>
        <CardDescription>
          Editing <code>{locale}</code> content.{" "}
          {def.slots.length > 0 &&
            `Slots (${def.slots.map((s) => s.name).join(", ")}) are filled per route.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onVariantChange(variantDraft.trim());
          }}
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="section-variant">Variant</Label>
            <Input
              id="section-variant"
              placeholder="(default)"
              value={variantDraft}
              onChange={(event) => setVariantDraft(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Load
          </Button>
        </form>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
            {def.fields.map((spec) => (
              <FieldControl
                key={spec.name}
                spec={spec}
                value={fields[spec.name]}
                onChange={(value) => setField(spec.name, value)}
              />
            ))}

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

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => void handleDelete()}
              >
                Delete
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
