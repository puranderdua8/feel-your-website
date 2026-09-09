---
"@feel-your-website/action-core": minor
---

New package `@feel-your-website/action-core` — the registered-actions
vocabulary. Inert: nothing consumes it yet.

- `ActionDefinition` — a discriminated union `QueryActionDefinition |
MutationActionDefinition` over a shared base, so `cache` (query) and
  `idempotent` / `confirm` (mutation) are only valid where they mean something.
  Plus `ActionInputSpec` (= `SectionFieldSpec`), `ActionInputMapping`,
  `ActionInvocation`, `ActionResult`, `ActionErrorCode`.
- `ActionInvoker` + `ActionContext` — the interface a concrete invoker
  implements; expected failures are an `ok: false` result, never a throw.
- `ActionError` / `isActionError` / `ACTION_TIMEOUT_MS`.
- `ActionCacheStore` (a deliberately dumb sync key/value seam) +
  `InMemoryActionCacheStore` + `CacheEntry`.

Validators, the catalog instance, the memory invoker, and the contract suite
land in follow-up PRs.
