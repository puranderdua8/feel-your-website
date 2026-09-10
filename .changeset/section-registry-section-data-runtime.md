---
"@feel-your-website/section-registry": minor
---

Add the pure section-data aggregator (inert — nothing calls it yet):

- `section-data.ts` — `SectionQuerySpec` (`deriveInvocation(fields, route)` →
  `QueryInvocation | null`, optional `project`, `previewSample`, `blocking`) and
  an empty `SECTION_QUERY_REGISTRY`. No dependency on `action-core`: a query
  invocation is a resolved `{ actionId, body }`, since query inputs are
  `static` / `routeParam` only.
- `section-data-runtime.ts`:
  - `collectInvocations(trees, locale, route, registry)` — walks every layer's
    tree (`flattenNodes`, slots included) and derives each specced section's
    invocation.
  - `planInvocations(collected)` — collapses identical `actionId` + body
    (stable-stringified) into one call, mapping each `instanceId` back to it.
  - `runQueries(plan, invoker, options)` — one `Promise.allSettled` under a
    shared abort budget; a rejection / `ok: false` / `parseResult` null /
    `project` null / over-`maxEntryBytes` payload each become
    `{ ok: false, error: { code } }`, keyed by `instanceId`.
