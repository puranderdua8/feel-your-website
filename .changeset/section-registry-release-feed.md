---
"@feel-your-website/section-registry": minor
---

Add `release-feed` — the worked example of a data-backed section.

- `sectionCatalog`: a `release-feed` entry (a `heading` plus a `count` knob,
  1–20, default 5) — authorable like any other section, but it renders no
  content of its own.
- `SECTION_REGISTRY`: `ReleaseFeedSection`, which renders the list handed to it
  in `props.data` and falls back to one line for an absent / failed / unparseable
  payload.
- `SECTION_QUERY_REGISTRY`: a `release-feed` entry wired to the `feed.releases`
  registered query — `deriveInvocation` clamps `count` into the request body,
  `project` is `parseReleases`, and a `previewSample` is supplied for the CMS.
- `parseReleases(raw): Release[] | null` and the `Release` type are exported,
  built on `@feel-your-website/json-guards` (a new dependency of this package).

This is the first non-empty `SECTION_QUERY_REGISTRY` entry, so the shell's
`loadRoutePage` fan-out now does real work for any route that includes a
`release-feed` node.
