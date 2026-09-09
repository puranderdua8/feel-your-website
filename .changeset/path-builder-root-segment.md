---
"@feel-your-website/cms": patch
---

A top-level route could not be created through the route editor. On a root
route the path builder's "+ segment" button was a no-op — an empty root
segment serialises to `/`, which parses straight back to zero segments, so the
row it was meant to add never appeared and the path stayed stuck at `/`. Every
existing route had been seeded.

The path builder now always renders one segment row (root as well as child, the
same fix child routes already have): an empty root row is just the homepage
`/`, and "+ segment" — enabled only once the current row has text, so it's
never a silent no-op — adds further segments.
