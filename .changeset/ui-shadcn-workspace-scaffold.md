---
"@feel-your-website/ui": patch
"@feel-your-website/theme": patch
---

Restructure `@feel-your-website/ui` as a canonical shadcn workspace package.

Components move from `src/components/<name>/<name>.tsx` to shadcn's flat
`src/components/ui/<name>.tsx` layout (stories move alongside). A
`components.json` is added at the package root (`style: new-york`,
`iconLibrary: lucide`, `cssVariables: true`, aliases pointing at
`@feel-your-website/ui/...`), plus a thin `components.json` in each app so a
future `pnpm dlx shadcn add <x>` run from `apps/shell` or `apps/cms` routes
base components into this package. A standalone `src/styles/globals.css`
(imports the theme preset, plus a static `base`-theme `:root`/`.dark`
fallback for provider-less rendering) backs the CLI and any future
Storybook. `src/barrel.test.ts` now fails if a `components/ui/*` file is
added without a matching re-export in the hand-maintained `src/index.ts`.

No component behaviour or public export changes — the barrel exports the
same 10 components. Canonical shadcn component source (and `lucide-react` /
`@radix-ui/react-slot` / the animation-utility deps) land in the follow-up
batches.

Also fixes `@feel-your-website/theme`'s `baseDark` chart palette: it drew
`chart-2..5` from the `400` step of the primitive colour ramps, whose
chroma tapers to near-grey below step `500`, so dark-mode charts would have
rendered five near-identical greys. They now use the saturated `500` step,
matching light mode.
