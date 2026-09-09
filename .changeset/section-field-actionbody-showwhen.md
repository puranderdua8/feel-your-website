---
"@feel-your-website/content-core": minor
"@feel-your-website/cms": patch
---

`SectionFieldSpec` gains two additive, backward-compatible members:

- `type: "actionBody"` — a new `SectionFieldType` for a per-input source mapping
  that binds a registered action's inputs. Nothing uses it yet.
- `showWhen?: { field; equals }` — an editor-only affordance: the CMS form shows
  the field only when a sibling field strictly equals `equals`. No effect on
  validation or on what a section receives.

`apps/cms` `FieldControl` honours `showWhen` (via a new optional `siblings` prop
carrying the rest of the field bag) and renders `actionBody` as a raw-JSON
`Textarea` stub — a dedicated per-input picker replaces it later.
