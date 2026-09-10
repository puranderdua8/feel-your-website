---
"@feel-your-website/shell": patch
---

Add the `invokeAction` server fn — the endpoint a `mode: "action"` CTA POSTs to.
No UI calls it yet (the client form is next).

The client sends only `{ path, instanceId, requestId }`. The server
(`resolveAndInvokeAction`, extracted so it is testable without `createServerFn`):
`assertSameOrigin` → re-resolve the route from the published manifest → find the
`button` node by `instanceId` → read the action id / body mapping / RBAC
requirement off _published_ content → `buildActionBody` from re-sanitised route
params → `validateActionInput` → for an `idempotent` action, replay the first
result for a repeated `requestId` (process-local; a failed attempt is not
retained) → `getActionInvoker().invoke` → `parseResult`. Every expected failure
is an `ok: false` `ActionResult`, never a throw, and never carries upstream text.

`build-action-body.ts` gains `parseActionInputMapping` (the stored `actionBody`
JSON string → a typed mapping, or `null`). `loadBootstrap`'s session→permissions
block is extracted to a shared `resolveSessionPermissions` helper. 13 handler
tests with `MemoryActionInvoker`.
