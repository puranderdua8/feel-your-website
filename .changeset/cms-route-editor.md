---
"@feel-your-website/content-core": minor
"@feel-your-website/content-adapter-memory": patch
"@feel-your-website/config-bundle-supabase": patch
---

Rebuild the CMS Routes tab as a section-tree editor.

`@feel-your-website/content-core`: `RouteCompositionReader` gains
`listCompositions()` (route headers, drafts included) and a
`RouteCompositionSummary` type; `RouteComposition` now extends it. Both
adapter implementations follow.

`apps/cms` replaces `route-bundles-panel.tsx` (a checkbox list of template
keys) with `components/route-editor/`:

- **route list** — every route with its published state, plus "New"
- **section tree** — add / remove / reorder root sections; expand a node to
  fill its `SectionSlotSpec` slots with other sections, the picker filtered
  by `slot.accepts` and `arity`
- **section field form** — the selected node's section content at the active
  locale, the same schema-driven `FieldControl` the Sections tab uses (now
  extracted to `components/field-control.tsx`)
- **preview** — the shell's own `renderComposition`, in-process, re-rendering
  on every keystroke by merging unsaved field edits over fetched content
- **publish bar** — `checkRoutePublishReadiness` lists per-locale gaps and
  `Publish` is blocked until they clear (or the author forces it); `Save
draft` and `Publish` both go through `saveRouteComposition`

`listRouteCompositions` BFF fn added.
