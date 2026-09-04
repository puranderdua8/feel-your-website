import type { RouteSectionNode, SectionSlotSpec } from "@feel-your-website/content-core";
import { Button } from "@feel-your-website/ui";
import { useState } from "react";

import { sectionCatalog } from "@/content/sections";

import {
  addSlotChild,
  hasOutlet,
  moveRoot,
  newNode,
  newOutletNode,
  removeNode,
} from "./tree-ops.js";

/**
 * The section-instance tree editor. Add / remove / reorder root sections;
 * expand a node to fill its slots with other sections (filtered by
 * `slot.accepts`). Selecting a node hands it to the field form on the side.
 *
 * `outlet` — where a layout route's matched child renders — is deliberately
 * not in `sectionCatalog`, so it never appears in the generic "add section"
 * dropdown. It gets its own control here instead, offered only while this
 * route has (or is being set up to have) children, and only once.
 */
export function SectionTree({
  tree,
  selectedId,
  isLayout,
  onSelect,
  onChange,
}: {
  tree: readonly RouteSectionNode[];
  selectedId: string | null;
  /** Whether this route has children or is meant to — gates the "Add outlet" control. */
  isLayout: boolean;
  onSelect: (id: string) => void;
  onChange: (tree: readonly RouteSectionNode[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {tree.length === 0 && (
        <p className="text-muted-foreground text-sm">No sections yet — add one below.</p>
      )}
      {tree.map((node, index) => (
        <SectionNode
          key={node.instanceId}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onRemove={() => onChange(removeNode(tree, node.instanceId))}
          onMoveUp={index > 0 ? () => onChange(moveRoot(tree, node.instanceId, -1)) : undefined}
          onMoveDown={
            index < tree.length - 1 ? () => onChange(moveRoot(tree, node.instanceId, 1)) : undefined
          }
          onAddSlotChild={(parentId, slot, key) =>
            onChange(addSlotChild(tree, parentId, slot, newNode(key)))
          }
          onRemoveDescendant={(id) => onChange(removeNode(tree, id))}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <AddSection
          accepts={[]}
          label="Add root section"
          onAdd={(key) => onChange([...tree, newNode(key)])}
        />
        {isLayout && !hasOutlet(tree) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange([...tree, newOutletNode()])}
          >
            + Add outlet
          </Button>
        )}
      </div>
    </div>
  );
}

function SectionNode({
  node,
  depth,
  selectedId,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddSlotChild,
  onRemoveDescendant,
}: {
  node: RouteSectionNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddSlotChild: (parentId: string, slot: string, key: string) => void;
  onRemoveDescendant: (id: string) => void;
}) {
  const def = sectionCatalog.byKey.get(node.sectionKey);
  const [open, setOpen] = useState(depth === 0);
  const hasSlots = (def?.slots.length ?? 0) > 0;

  return (
    <div
      className="border-border rounded-[var(--radius)] border p-2"
      style={{ marginLeft: depth * 12 }}
    >
      <div className="flex items-center gap-2">
        {hasSlots && (
          <button
            type="button"
            className="text-muted-foreground w-4 text-xs"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? "▾" : "▸"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSelect(node.instanceId)}
          className={`flex-1 rounded px-1.5 py-1 text-left text-sm ${
            node.instanceId === selectedId
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent/50"
          }`}
        >
          <span className="font-medium">{node.sectionKey}</span>
        </button>
        {onMoveUp && (
          <Button type="button" size="sm" variant="ghost" onClick={onMoveUp} aria-label="Move up">
            ↑
          </Button>
        )}
        {onMoveDown && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onMoveDown}
            aria-label="Move down"
          >
            ↓
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label="Remove">
          ✕
        </Button>
      </div>

      {open && hasSlots && (
        <div className="mt-2 flex flex-col gap-3">
          {def!.slots.map((slot) => (
            <Slot
              key={slot.name}
              slot={slot}
              parentId={node.instanceId}
              nodes={node.slots[slot.name] ?? []}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddSlotChild={onAddSlotChild}
              onRemoveDescendant={onRemoveDescendant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Slot({
  slot,
  parentId,
  nodes,
  depth,
  selectedId,
  onSelect,
  onAddSlotChild,
  onRemoveDescendant,
}: {
  slot: SectionSlotSpec;
  parentId: string;
  nodes: readonly RouteSectionNode[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddSlotChild: (parentId: string, slot: string, key: string) => void;
  onRemoveDescendant: (id: string) => void;
}) {
  const full = slot.arity === "single" && nodes.length >= 1;

  return (
    <div style={{ marginLeft: depth * 12 }}>
      <p className="text-xs font-medium">
        slot: {slot.name}
        {slot.required && <span className="text-destructive"> *</span>}{" "}
        <span className="text-muted-foreground">
          ({slot.arity}
          {slot.accepts.length > 0 && `, accepts ${slot.accepts.join(" / ")}`})
        </span>
      </p>
      <div className="mt-1 flex flex-col gap-2">
        {nodes.map((child) => (
          <SectionNode
            key={child.instanceId}
            node={child}
            depth={depth}
            selectedId={selectedId}
            onSelect={onSelect}
            onRemove={() => onRemoveDescendant(child.instanceId)}
            onAddSlotChild={onAddSlotChild}
            onRemoveDescendant={onRemoveDescendant}
          />
        ))}
        {!full && (
          <AddSection
            accepts={slot.accepts}
            label={`Fill ${slot.name}`}
            onAdd={(key) => onAddSlotChild(parentId, slot.name, key)}
          />
        )}
      </div>
    </div>
  );
}

function AddSection({
  accepts,
  label,
  onAdd,
}: {
  accepts: readonly string[];
  label: string;
  onAdd: (key: string) => void;
}) {
  const options =
    accepts.length > 0
      ? sectionCatalog.definitions.filter((d) => accepts.includes(d.key))
      : sectionCatalog.definitions;
  const [key, setKey] = useState(options[0]?.key ?? "");

  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <select
          className="border-input h-8 rounded-md border bg-transparent px-2 text-sm"
          value={key}
          onChange={(event) => setKey(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>
              {option.key}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" size="sm" disabled={!key} onClick={() => onAdd(key)}>
        Add
      </Button>
    </div>
  );
}
