---
"@feel-your-website/action-registry": minor
---

New package `@feel-your-website/action-registry` — the registered-actions
catalog instance. Ships three example actions, the way `sectionCatalog` ships
example sections; a real project replaces the list alongside the invoker's
bindings.

- `feed.releases` — `query` / `GET`, cached (60 s, SWR, 10 s negative).
- `newsletter.subscribe` — `mutation` / `POST`, `idempotent`.
- `webhook.trigger` — `mutation` / `POST`, `confirm`.

No app wires it yet.
