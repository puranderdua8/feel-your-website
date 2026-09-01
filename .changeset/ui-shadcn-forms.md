---
"@feel-your-website/ui": minor
---

Add the shadcn/ui form & input primitives, from canonical Tailwind v4 source.

New: `textarea`, `checkbox`, `radio-group`, `switch`, `toggle`,
`toggle-group`, `input-otp`, `form` (the `react-hook-form` context
components — `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`,
`FormDescription`, `FormMessage`, `useFormField`).

Rewritten to canonical shadcn v4 (`--overwrite`): `button` (now with
`asChild`, `link` variant, `size` incl. `icon-*`), `input`, `label`,
`select` (now exports `SelectGroup`, `SelectLabel`, `SelectSeparator`,
scroll buttons). These drop `React.forwardRef` for the current
`function Component(props: React.ComponentProps<…>)` form with `data-slot`
attributes — a behaviour change for anyone forwarding a `ref`, though no
consumer in this repo does.

Source is pulled verbatim from `ui.shadcn.com/r/styles/new-york-v4` and
adapted only for this repo's conventions: relative `../../lib/utils.js`
imports instead of the `@/` alias, and the `"use client"` directive removed
(the apps are TanStack Start, no RSC — matches the existing components).

New dependencies: `radix-ui` (the unified package shadcn v4 uses, replacing
per-primitive `@radix-ui/react-*` as components are migrated),
`lucide-react`, `input-otp`, `react-hook-form`. The legacy scoped
`@radix-ui/react-*` deps stay for the not-yet-migrated components
(dialog/dropdown-menu/tabs/tooltip) and are removed in a later batch.

`theme-contract.test.ts` gains an `EXTERNALLY_PROVIDED` allowlist for
`--radix-select-trigger-{height,width}` (published by Radix) and `--gap`
(set by `<ToggleGroup>` on itself).
