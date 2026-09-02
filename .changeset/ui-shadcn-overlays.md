---
"@feel-your-website/ui": minor
---

Add the shadcn/ui overlay & navigation components, from canonical Tailwind
v4 source.

New: `alert-dialog`, `sheet`, `drawer`, `popover`, `context-menu`,
`menubar`, `navigation-menu`, `command`, `hover-card`.

Rewritten to canonical shadcn v4 (`--overwrite`): `dialog`,
`dropdown-menu`, `tooltip` — these move onto the unified `radix-ui`
package, drop `React.forwardRef`, and gain `data-slot` attributes and the
v4 open/close animation classes.

New dependencies: `vaul` (drawer), `cmdk` (command). `radix-ui` /
`lucide-react` were already added in the forms batch.

`theme-contract.test.ts`'s `EXTERNALLY_PROVIDED` allowlist gains
`--radix-navigation-menu-viewport-{height,width}` (published by Radix's
NavigationMenu). Axe smoke cases added for `AlertDialog`, `Popover`,
`Command`.

Same adaptation as the forms batch: source pulled verbatim from
`ui.shadcn.com/r/styles/new-york-v4`, imports rewritten to relative
`../../lib/utils.js` / `./<x>.js`, `"use client"` removed.
