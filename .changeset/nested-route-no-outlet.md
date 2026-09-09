---
"@feel-your-website/shell": patch
---

A nested route whose parent has no `outlet` node rendered the **parent's**
page instead of its own. `RoutePageView` folded every layer in the chain
unconditionally, so a parent without an outlet was still wrapped around the
matched route — and with nowhere to place the child, `renderComposition`
simply dropped it, leaving the parent's content on screen. (The breadcrumb
trail, built from a separate `chain`, looked correct, which made it easy to
miss.)

`RouteLayer` now carries `hasOutlet`, and the renderer skips a parent layer
that doesn't have one: the matched route renders standalone (its breadcrumb
trail still shows the hierarchy), which is what the plan always intended for a
parent that isn't a layout. Add an `outlet` to the parent in the CMS to nest
the child inside it instead.
