---
"@feel-your-website/section-registry": minor
"@feel-your-website/cms": patch
---

Add the action-mode CTA surface (inert — no host wires `renderActionCta` yet).

- `RenderCompositionOptions.renderActionCta?` and matching `ActionCtaSpec` /
  `RenderActionCta` types (new `action-cta.ts`). A `button` with `mode: "action"`
  hands `{ instanceId, actionId, label, successLabel?, body, className }` to the
  host renderer; with no renderer (the CMS preview, the section gallery) it
  renders the disabled placeholder, exactly as it did before.
- `sectionCatalog` `button` gains `actionId` (text), `body` (`actionBody`) and
  `successLabel` (text), all `showWhen: { mode: "action" }`.
- `validateButtonSection`: in `action` mode, a missing `actionId` is a blocking
  issue. Catalog-aware checks (unknown id, wrong `kind`, body mapping) stay in
  the CMS, which can import the action catalog.
- `renderSection`'s 4th+ positional args collapse into one `RenderSectionExtras`
  object (`route`, `renderLink`, `renderActionCta`, `instanceId`, `data`).
  Internal — apps call `renderComposition`, not `renderSection`.

`cms`: route publish-readiness now flags an action-mode button that names no
action (a draft can still be saved).
