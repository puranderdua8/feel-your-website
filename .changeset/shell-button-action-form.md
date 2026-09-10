---
"@feel-your-website/shell": patch
---

Wire the mutation CTA end to end — a `mode: "action"` button now fires its
registered action.

`button-action-form.tsx` provides `renderActionCta`, threaded into
`renderComposition` by `RoutePageView`. The button POSTs `invokeAction` with
only the pathname, the node's `instanceId`, and a fresh `requestId` per submit —
never the action id, body, or a tree.

States: idle / submitting / success / error. The button is disabled while a
call is in flight and stays disabled after success; a failure re-enables it and
a retry uses a new `requestId`. A `confirm` action prompts first. Failures show
a normalised, code-based message (never upstream text) with any field issues
listed. A11y: `aria-busy` on the button, an `aria-live` `role="status"` region
it is `aria-describedby`-linked to, and focus moves to that region on
completion.

10 RTL tests with `invokeAction` mocked.
