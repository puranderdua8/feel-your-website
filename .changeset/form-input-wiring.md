---
"@feel-your-website/action-registry": minor
"@feel-your-website/action-core": minor
"@feel-your-website/shell": patch
"@feel-your-website/cms": patch
---

Wire the `formInput` primitive end to end (A25b).

- **`newsletter.subscribe`** now lists `formInput` in `allowedSources`, so a
  `form` section can supply its `email`. The other seed mutations are
  unchanged.
- **`validateActionBinding`** takes an optional `formInputNames` — when given,
  a `formInput` mapping that names a field the form does not have is reported.
  The shell omits it (it rebuilds the body from `def.input` and re-runs
  `validateActionInput`); the CMS passes the enclosing form's `field` names so
  a typo is caught at publish, not at click.
- **`ButtonActionForm`** forwards `ActionCtaSpec.formInput` (the enclosing
  form's current values) on submit. The server still re-derives every other
  part of the body and only reads declared inputs from what was sent.
- **CMS publish gating** (`collectRouteButtonIssues`) resolves each action
  button's sibling `field` names from its `form` and blocks a `formInput`
  mapping that names an unknown field — or that sits on a button with no
  enclosing form at all.
