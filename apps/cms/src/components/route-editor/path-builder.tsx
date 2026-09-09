import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@feel-your-website/ui";

interface Segment {
  kind: "static" | "param";
  /** Static: the literal text. Param: the bare name, no `:`. */
  value: string;
}

/**
 * `/blog/:slug` (root) -> two segments. `:slug` (child) -> one. `/` (root,
 * empty) -> none. A leading `/` is stripped either way — a child's segment
 * should never carry one, but `pathSegment` can transiently still hold a
 * root's `"/"` for one render right after `parentId` changes (`index.tsx`
 * resets it properly on the next state update; this keeps that instant from
 * rendering `(invalid)`).
 *
 * A trailing empty segment (`/blog/`, `about/`) is kept — it is the "row the
 * author is about to type into" that `add()` produces; `serializeSegments`
 * round-trips it.
 */
function parseSegments(pathSegment: string): Segment[] {
  const body = pathSegment.replace(/^\//, "");
  if (body === "") return [];
  return body
    .split("/")
    .map((raw) =>
      raw.startsWith(":") ? { kind: "param", value: raw.slice(1) } : { kind: "static", value: raw },
    );
}

function serializeSegments(segments: readonly Segment[], isRoot: boolean): string {
  const body = segments.map((s) => (s.kind === "param" ? `:${s.value}` : s.value)).join("/");
  return isRoot ? `/${body}` : body;
}

/**
 * Edits a route's own path contribution as a sequence of static-text or
 * `:param` segments. A root route (`parentPath === null`) may have several —
 * its segment string is the whole absolute pattern; a nested route contributes
 * exactly one, shown after the parent's (locked) pattern as a fixed prefix.
 *
 * Emits the raw segment string (`onChange`); `composeAbsolutePattern` /
 * `validateRouteInput` do the composing and validating elsewhere.
 */
export function PathBuilder({
  parentPath,
  pathSegment,
  onChange,
}: {
  parentPath: string | null;
  pathSegment: string;
  onChange: (pathSegment: string) => void;
}) {
  const isRoot = parentPath === null;
  const parsed = parseSegments(pathSegment);
  // Always render at least one segment row, for a root as well as a child: an
  // empty single segment and zero segments both serialise the same (`/` for a
  // root, `""` for a child), so a row gated behind "+ segment" could never be
  // reached — a root route would be uncreatable. One always-present row means
  // an empty root row is simply the homepage `/`, and "+ segment" adds beyond
  // the first.
  const segments = parsed.length > 0 ? parsed : [{ kind: "static", value: "" } as Segment];

  function replace(index: number, next: Segment): void {
    const copy = [...segments];
    copy[index] = next;
    onChange(serializeSegments(copy, isRoot));
  }

  function remove(index: number): void {
    onChange(
      serializeSegments(
        segments.filter((_, i) => i !== index),
        isRoot,
      ),
    );
  }

  function add(): void {
    onChange(serializeSegments([...segments, { kind: "static", value: "" }], isRoot));
  }

  const lastSegment = segments[segments.length - 1];
  // Only a root has multiple own segments. Disabled while the current last row
  // is still blank, so the button is never a silent no-op.
  const canAddMore = isRoot && lastSegment !== undefined && lastSegment.value.trim() !== "";
  const canRemove = segments.length > 1; // a nested route always keeps its one segment

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {!isRoot && (
          <span className="text-muted-foreground bg-muted rounded px-2 py-1 font-mono text-sm">
            {parentPath}/
          </span>
        )}
        {segments.map((segment, index) => (
          <div key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-muted-foreground">/</span>}
            <Select
              value={segment.kind}
              onValueChange={(kind) => replace(index, { kind: kind as Segment["kind"], value: "" })}
            >
              <SelectTrigger size="sm" className="w-24" aria-label={`Segment ${index + 1} type`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Text</SelectItem>
                <SelectItem value="param">Param</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label={
                segment.kind === "param" ? `Segment ${index + 1} name` : `Segment ${index + 1}`
              }
              className="h-8 w-32 font-mono text-sm"
              placeholder={segment.kind === "param" ? "slug" : "about"}
              value={segment.value}
              onChange={(e) => replace(index, { ...segment, value: e.target.value })}
            />
            {canRemove && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={`Remove segment ${index + 1}`}
                onClick={() => remove(index)}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        {isRoot && (
          <Button type="button" size="sm" variant="outline" disabled={!canAddMore} onClick={add}>
            + segment
          </Button>
        )}
      </div>
    </div>
  );
}
