import type { JsonValue, SectionFieldSpec } from "@feel-your-website/content-core";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@feel-your-website/ui";

/**
 * One form control for one `SectionFieldSpec.type`. Shared by the Sections
 * surface and the route editor's section-field form so both render a
 * schema-driven field identically.
 */
export function FieldControl({
  spec,
  value,
  onChange,
  siblings,
  idPrefix = "field",
}: {
  spec: SectionFieldSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  /**
   * The other fields in the same form, so a `spec.showWhen` predicate can be
   * evaluated. Omit and every field renders.
   */
  siblings?: Readonly<Record<string, JsonValue>>;
  /** Namespaces the control's `id`, so two forms on one page don't collide. */
  idPrefix?: string;
}) {
  // `showWhen` is a pure editor affordance: hide a field whose gating sibling
  // isn't set to the expected value. Nothing about validation or rendering
  // depends on it.
  if (spec.showWhen && siblings?.[spec.showWhen.field] !== spec.showWhen.equals) {
    return null;
  }

  const id = `${idPrefix}-${spec.name}`;
  const str = typeof value === "string" ? value : "";

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {spec.label}
        {spec.required && <span className="text-destructive"> *</span>}
      </Label>

      {spec.type === "richtext" ? (
        <Textarea id={id} value={str} onChange={(event) => onChange(event.target.value)} />
      ) : spec.type === "actionBody" ? (
        // Stub control: the request-body mapping is authored as raw JSON text
        // for now and interpreted at publish time. A dedicated per-input
        // source picker replaces this later.
        <Textarea
          id={id}
          value={str}
          rows={6}
          className="font-mono text-xs"
          placeholder={'{ "email": { "source": "routeParam", "value": "slug" } }'}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : spec.type === "boolean" ? (
        <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
      ) : spec.type === "select" ? (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {(spec.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : spec.type === "number" ? (
        <Input
          id={id}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
        />
      ) : (
        <Input
          id={id}
          type={spec.type === "url" || spec.type === "image" ? "url" : "text"}
          value={str}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {spec.type === "image" && str && (
        <img
          src={str}
          alt=""
          className="border-border mt-1 max-h-24 rounded-md border object-contain"
        />
      )}
      {spec.helpText && <p className="text-muted-foreground text-xs">{spec.helpText}</p>}
    </div>
  );
}
