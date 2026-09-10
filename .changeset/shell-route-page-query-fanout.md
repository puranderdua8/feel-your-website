---
"@feel-your-website/shell": minor
"@feel-your-website/section-registry": patch
---

Wire the section-data query fan-out into `loadRoutePage`.

After a route resolves, the BFF walks its section trees for query-action
references (`collectInvocations`), collapses identical calls (`planInvocations`)
and runs them under one shared budget (`runQueries`, `SECTION_QUERY_BUDGET_MS`,
kept below `CONTENT_TIMEOUT_MS`), then attaches the per-instance results as
`RoutePage.sectionData`. `RoutePageView` threads that into `renderComposition`.

Inert in practice until a data-backed section is registered: `collectInvocations`
finds nothing while `SECTION_QUERY_REGISTRY` is empty, so no invoker call is made
and `sectionData` stays absent. A fan-out failure degrades to no `sectionData`
(never a 500); a single failed call becomes that section's error entry.

The fan-out logic lives in `route-page-data.ts` as a pure, invoker-injected
helper so it is unit-tested without `createServerFn`.

`section-registry`: `SectionDataEntry.data` is now typed `JsonValue` rather than
`unknown` — it rides on `RoutePage` across the BFF→client JSON boundary, so the
server-fn serialiser must be able to see it is serialisable.
