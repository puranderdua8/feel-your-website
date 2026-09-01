---
"@feel-your-website/ui": minor
---

Add the shadcn/ui data & feedback components, from canonical Tailwind v4
source — completing the shadcn component set.

New: `table`, `pagination`, `breadcrumb`, `progress`, `slider`, `alert`,
`sonner` (`<Toaster>`), `chart` (`ChartContainer` / `ChartTooltip` /
`ChartLegend` + the recharts context), `calendar`, `carousel`.

New dependencies: `sonner`, `recharts`, `react-day-picker`, `date-fns`,
`embla-carousel-react`.

Adaptations beyond the usual import rewrites:

- `sonner.tsx` drops its `next-themes` dependency (this repo's dark mode is
  a `.dark` class from `@feel-your-website/theme`, not next-themes). It
  defaults to `theme="system"`; the consuming app passes `theme={mode}`
  from its own `useTheme()`.
- `pagination.tsx` carries one `eslint-disable jsx-a11y/anchor-has-content`
  on `PaginationLink` — content is supplied by the consumer.

`theme-contract.test.ts`'s `EXTERNALLY_PROVIDED` gains `--spacing`
(Tailwind v4 core). Axe cases added for `Alert`, `Breadcrumb`, `Progress`,
`Table`.

Cleanup (end of the A2 track): every dead `*.stories.tsx` is removed (no
Storybook is installed), the `@storybook/react` devDependency and the
`storybook-static/**` turbo build output are dropped.
