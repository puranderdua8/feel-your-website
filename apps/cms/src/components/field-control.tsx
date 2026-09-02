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
  idPrefix = "field",
}: {
  spec: SectionFieldSpec;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  /** Namespaces the control's `id`, so two forms on one page don't collide. */
  idPrefix?: string;
}) {
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
