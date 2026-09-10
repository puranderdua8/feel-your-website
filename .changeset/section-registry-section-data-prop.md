---
"@feel-your-website/section-registry": minor
---

Thread per-instance external data through the render, additively:

- `SectionDataEntry` = `{ ok: true; data: unknown } | { ok: false; error: { code } }`.
- `SectionComponentProps.data?: SectionDataEntry` — a section that pulls
  external data reads this; every existing section ignores it.
- `RenderCompositionOptions.sectionData?: Record<instanceId, SectionDataEntry>`
  — `renderNode` hands each node `sectionData[node.instanceId]`.

Inert — nothing produces `sectionData` yet.
