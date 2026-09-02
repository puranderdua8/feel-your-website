---
"@feel-your-website/ui": minor
---

Add the shadcn/ui layout & display components, from canonical Tailwind v4
source.

New: `accordion`, `collapsible`, `separator`, `aspect-ratio`, `avatar`,
`skeleton`, `scroll-area`, `resizable`, `sidebar` (the full app-shell
primitive — `SidebarProvider`, `Sidebar`, `SidebarMenu*`, `useSidebar`,
etc.), plus the `use-mobile` (`useIsMobile`) hook in `src/hooks/`.

Rewritten to canonical shadcn v4 (`--overwrite`): `card` (now
`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`/`CardFooter`
with `data-slot`), `tabs`, `badge` (adds `asChild`, `link`-less variant
set with `data-slot`).

New dependency: `react-resizable-panels` (resizable). `radix-ui` /
`lucide-react` already present.

`theme-contract.test.ts`'s `EXTERNALLY_PROVIDED` gains `--sidebar-width` /
`--sidebar-width-icon` (layout constants `<SidebarProvider>` sets on itself
via inline `style`). Axe cases added for `Accordion` and `Avatar`.
