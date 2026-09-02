---
"@feel-your-website/content-core": minor
"@feel-your-website/section-registry": minor
---

Add the section-schema layer and a schema-driven Sections surface in the CMS.

`@feel-your-website/content-core` gains `SectionRef` and a `section-schema`
module: `SectionFieldSpec` (typed: text / richtext / image / url / number /
boolean / select / icon), `SectionSlotSpec` (named slots with `accepts` +
`arity`), `SectionDefinition`, `SectionCatalog`, `defineSections()` (dedupe
on key, like `defineTemplateKeys`), `validateSectionFields()` (returns every
issue, doesn't throw), and `findUnknownSectionRefs()`.

`@feel-your-website/section-registry` exports `sectionCatalog` — schemas for
`hero` / `guidance` / `footer` (keys unchanged from the template catalog,
now with field schemas) plus the atoms `icon` / `text` / `image` / `button`
and the composite `card` (an `icon` slot and a `body` slot).

`apps/cms`: a new **Sections** tab (now the default) replaces raw-JSON
content authoring — pick a section, edit one of its content variants with a
form built from the field schema (`Input` / `Textarea` / `Switch` /
`Select` / number / URL+thumbnail per field type), in the locale chosen by
a new global **content-language** switcher in the header
(`ContentLocaleProvider`; CMS chrome stays English). New BFF fn
`getSectionContent` reads one exact `(key, variant, locale)` row, treating a
locale-fallback result as empty so an untranslated language shows a blank
form rather than the default locale's copy. The old Content tab is left in
place for now.
