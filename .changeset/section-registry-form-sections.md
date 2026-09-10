---
"@feel-your-website/section-registry": minor
---

Add the `field` and `form` sections and the `formInput` primitive (A25a).

- `form-context.tsx` — a small React context (`FormProvider` / `useFormContext`)
  that a `form` section owns and its descendants read. Outside a form the hook
  returns `null`, so every other section is unaffected.
- `FormSection` renders a `<form>` that swallows its own submit (the CTA does
  the work) and holds the input state, handing it down through `FormProvider`.
- `FieldSection` is a controlled input bound to that state by its `name` —
  the key an action CTA's `formInput` mapping references. Rendered outside a
  form it still shows, but nothing collects it.
- `ButtonSection` (action mode) now reads `useFormContext()` and, when it is
  inside a form, passes the current values as `ActionCtaSpec.formInput`. The
  key is omitted entirely when the button is not in a form, so existing
  action-CTA behaviour and its tests are unchanged.
- `sectionCatalog` gains `field` and `form` entries (with samples); the CMS
  picks them up through its re-export.

Inert until the shell forwards `formInput` on submit and `newsletter.subscribe`
accepts a `formInput` source (A25b). The server still re-derives and validates
the body — `formInput` is a hint to the form only.
