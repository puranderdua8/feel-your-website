---
"@feel-your-website/shell": patch
---

Bind the registered-actions invoker at the DI seam. `getActionInvoker()` in
`apps/shell/src/server/adapters.ts` returns:

- `none` (default) → a `NullActionInvoker` that always answers `not_found` —
  the zero-config state, no upstream, no credentials
- `memory` → `MemoryActionInvoker({ echoUnseeded: true })` for local work
- `http` → `HttpActionInvoker` (from `@feel-your-website/action-invoker-http`,
  bound against `actionCatalog` and the parsed `ACTION_CONFIG` bindings) wrapped
  in `CachingActionInvoker` over an in-memory store; `ACTION_CACHE="blobs"`
  throws until that store lands

`resetAdapters()` clears it. `seam.test.ts` adds
`@feel-your-website/action-invoker-http` to `CONCRETE_BACKENDS`, so it can only
be named here. Nothing calls `getActionInvoker()` yet.
