---
"@feel-your-website/action-invoker-http": minor
---

New package `@feel-your-website/action-invoker-http` — the production
`ActionInvoker`. Still inert: only the shell's DI seam will bind it.

- `parseHttpActionBindings(raw)` — turns a decoded config blob into
  `HttpActionBindings`, throwing a named error on the first bad field.
- `assertBindings(catalog, bindings, ctx)` — boot assertion: one binding per
  catalog action, method agreement, every host allow-listed and matching
  `allowedHost`, every `headersFromEnv` var set, `forwardUserAuth` only against
  a first-party host.
- `HttpActionInvoker` — resolves an action to its upstream, fills `:path`
  placeholders and places remaining allowed params on the query string (safe
  methods) or in a JSON body, applies `ACTION_TIMEOUT_MS` (or the binding's
  override) via `AbortController`, maps non-2xx to an `ActionErrorCode`, and
  never puts upstream text in the result. Forwards an idempotency key and a
  session token when the binding opts in.

`turbo.json` `globalEnv` gains `ACTION_HTTP_BASE_URL` (gates the live
`contract.test.ts`, which otherwise skips — `HttpActionInvoker.test.ts` runs
the shared contract with a stubbed `fetch`).
