---
"@feel-your-website/content-core": minor
"@feel-your-website/section-registry": minor
---

Give each section code-defined sample content, and turn the CMS Sections tab
into a read-only gallery.

`@feel-your-website/content-core`: `SectionDefinition` gains an optional
`sample` (`SectionSample` / `SectionSampleChild`) — placeholder fields, and
stand-in slot children for composites. Optional so bare test catalogs need
not supply it; every real section should.

`@feel-your-website/section-registry`: the catalog's nine sections each carry
a `sample`; new `renderSectionSample(def)` renders one section on its own with
that dummy content (falling back to the registry's own placeholder when a
section has no sample).

`apps/cms`: the Sections tab no longer edits content. It is a gallery — every
catalog section rendered with its sample data beside its field and slot
schema. A section is a container for whatever a route feeds it, not where
content lives; real content is authored in the Routes tab. This is the first
step of moving content ownership from sections to routes.
