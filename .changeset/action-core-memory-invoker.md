---
"@feel-your-website/action-core": minor
---

`@feel-your-website/action-core` gains its in-memory implementation and the
shared contract suite (still inert):

- `MemoryActionInvoker` — an `ActionInvoker` backed by a seed
  (`data` or `body → data` per action id), with `failWith` to force a failure
  code and `echoUnseeded` for the CMS dry-run preview. Used by tests and the
  CMS, never by the shell against a real upstream.
- `@feel-your-website/action-core/contract-tests` (new subpath export, its own
  `tsup` entry, `vitest` an optional peer) — `runActionInvokerContract`: a
  known id resolves to JSON-serialisable data, an unknown id is `not_found`
  without throwing, an unreachable upstream is `ok: false` with a code and no
  vendor text. Caching behaviour is left to the cache decorator's own tests.
- `contract.test.ts` runs the suite against `MemoryActionInvoker`.
