---
"@feel-your-website/tokens": major
"@feel-your-website/theme": major
---

Adopt shadcn/ui's canonical Tailwind v4 token vocabulary.

`Tier1Schema` gains the token set shadcn/ui components expect: `card`,
`cardForeground`, `popover`, `popoverForeground`, `input`, `chart1`..`chart5`,
and `sidebar`, `sidebarForeground`, `sidebarPrimary`,
`sidebarPrimaryForeground`, `sidebarAccent`, `sidebarAccentForeground`,
`sidebarBorder`, `sidebarRing`. Every existing Tier 1 field is unchanged, but
any code constructing a `Tier1Tokens` object directly (rather than going
through `resolveTheme`) must now supply these too — hence the major bump.

`compileCssVars` now emits Tier 1 tokens under their raw shadcn names
(`primary` → `--primary`, `cardForeground` → `--card-foreground`) instead of
prefixed with `--color-` (`--color-primary`). The `--color-*` prefix is now
purely the Tailwind utility namespace, registered by
`tailwind-preset.css`'s `@theme inline` mapping — any code reading a
`ThemeProvider`-injected variable directly by name (e.g.
`el.style.getPropertyValue("--color-primary")`) must switch to the new raw
name (`--primary`). Tier 2 variable names are unchanged.

The radius scale (`--radius-sm/md/lg/xl`, shadcn's canonical calc-based
4-step scale) is now registered once in the shared preset instead of being
duplicated in every consuming app's own stylesheet.

`@feel-your-website/theme` also now ships `tw-animate-css` (shadcn/ui's
Tailwind v4 animation utilities) as a real dependency, imported once at the
top of the shared preset — no consumer needs to depend on or import it
itself.

`base`/`baseDark` (the always-complete theme floor) declare every new token
explicitly, derived from tokens already on the same theme (`card`/`popover`
mirror the page surface, `input` mirrors `border`, `sidebar*` mirrors its
non-sidebar counterpart, `chart1` is `primary` with `chart2..5` drawn from
the existing `green`/`amber`/`violet`/`red` primitive colour ramps).
`corporate` and `playful` inherit all of these from the floor, unchanged —
same as they already do for the original Tier 1 fields.

No visible change to any app: verified by screenshot (light/dark, all three
themes) and a runtime check that every shadcn variable name resolves to a
real value.
