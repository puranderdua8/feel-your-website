---
"@feel-your-website/content-core": patch
"@feel-your-website/content-adapter-memory": patch
---

`runRouteCompositionWriterContract` takes an optional `readerFor(writer)`. When
given, the shared suite adds read-back assertions — currently that `hasOutlet`
on the route summary reflects the saved tree (plain vs. layout, and flips when
an outlet is added) — so that check runs against every backend wired to the
contract rather than only in the memory adapter's own test file, where it lived
before.
