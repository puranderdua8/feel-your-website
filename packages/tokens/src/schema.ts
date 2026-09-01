import { z } from "zod";

/**
 * A CSS color value. We keep this loose (any non-empty string) rather than
 * strictly validating OKLCH syntax — themes may reasonably want to fall back
 * to any valid CSS color function.
 */
const colorValue = z.string().min(1);
const cssLength = z.string().min(1);

export const ColorRampSchema = z.record(z.string(), z.string());

/** Tier 0 — raw, non-semantic primitives. */
export const PrimitivesSchema = z.object({
  colors: z.record(z.string(), ColorRampSchema),
  spacing: z.record(z.string(), cssLength),
  radius: z.record(z.string(), cssLength),
  typography: z.object({
    fontFamily: z.record(z.string(), z.string()),
    fontSize: z.record(
      z.string(),
      z.object({
        size: cssLength,
        lineHeight: cssLength,
      }),
    ),
    fontWeight: z.record(z.string(), z.string()),
  }),
});

/**
 * Tier 1 — core semantic tokens. This is the minimum set any theme must
 * (eventually, once resolved) define.
 *
 * The names and pairings mirror shadcn/ui's canonical Tailwind v4 token
 * vocabulary 1:1 (`background`/`foreground`, `card`, `popover`, `input`,
 * `chart1`..`chart5`, `sidebar*`), so a component vendored straight from the
 * shadcn registry resolves against this theme with no rewrites.
 */
export const Tier1Schema = z.object({
  background: colorValue,
  foreground: colorValue,
  card: colorValue,
  cardForeground: colorValue,
  popover: colorValue,
  popoverForeground: colorValue,
  primary: colorValue,
  primaryForeground: colorValue,
  secondary: colorValue,
  secondaryForeground: colorValue,
  muted: colorValue,
  mutedForeground: colorValue,
  accent: colorValue,
  accentForeground: colorValue,
  destructive: colorValue,
  destructiveForeground: colorValue,
  border: colorValue,
  input: colorValue,
  ring: colorValue,
  chart1: colorValue,
  chart2: colorValue,
  chart3: colorValue,
  chart4: colorValue,
  chart5: colorValue,
  sidebar: colorValue,
  sidebarForeground: colorValue,
  sidebarPrimary: colorValue,
  sidebarPrimaryForeground: colorValue,
  sidebarAccent: colorValue,
  sidebarAccentForeground: colorValue,
  sidebarBorder: colorValue,
  sidebarRing: colorValue,
  radius: cssLength,
  fontSans: z.string(),
  fontMono: z.string(),
});

/**
 * Tier 2 — extended / component tokens. Each of these has a pure derivation
 * function in `derivations.ts` that computes a structurally sound default
 * from Tier 1, so a theme only needs to override the ones it cares about.
 */
export const Tier2Schema = z.object({
  buttonHover: colorValue,
  buttonActive: colorValue,
  cardShadow: z.string(),
  inputBorder: colorValue,
  focusRingWidth: cssLength,
  focusRingColor: colorValue,
});

/** The full Tier 0–2 shape of a fully-resolved token set. */
export const TokenSchema = z.object({
  primitives: PrimitivesSchema,
  tier1: Tier1Schema,
  tier2: Tier2Schema,
});

export type Primitives = z.infer<typeof PrimitivesSchema>;
export type Tier1Tokens = z.infer<typeof Tier1Schema>;
export type Tier2Tokens = z.infer<typeof Tier2Schema>;
export type Tokens = z.infer<typeof TokenSchema>;

/** Recursively makes every property of `T` optional. */
export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/**
 * The subset of a theme that can differ between light and dark mode.
 * Primitives are mode-independent, so only Tier 1 and Tier 2 appear here.
 */
export type ThemeModeOverrides = DeepPartial<Pick<Tokens, "tier1" | "tier2">>;

/**
 * A theme is "however much of the full token shape it filled in" — every
 * theme file (base, corporate, playful, …) is a `ThemeConfig`, and
 * `resolveTheme` is responsible for filling in the rest.
 *
 * The top-level `tier1`/`tier2` describe the theme's **light** appearance.
 * A theme wanting a branded dark mode declares it explicitly under `dark`;
 * those values are layered onto the dark floor instead of the light ones.
 * Omitting `dark` yields the neutral dark floor, rather than a light palette
 * pasted on top of a dark background — see `resolveTheme`.
 */
export type ThemeConfig = DeepPartial<Tokens> & {
  dark?: ThemeModeOverrides;
};
