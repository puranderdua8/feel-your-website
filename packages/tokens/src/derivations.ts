import type { Tier1Tokens, Tier2Tokens } from "./schema.js";

interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

const OKLCH_PATTERN = /oklch\(([^)]+)\)/i;

/**
 * Parses a `oklch(L C H)` or `oklch(L C H / A)` string. Falls back to a
 * mid-gray if the input isn't OKLCH (e.g. a theme used `hsl()` or a named
 * color) so derivations never throw on unexpected but valid CSS input.
 */
function toFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseOklch(value: string): Oklch {
  const match = OKLCH_PATTERN.exec(value);
  if (!match) {
    return { l: 0.5, c: 0, h: 0 };
  }
  const body = match[1] ?? "";
  const [components, alphaPart] = body.split("/").map((part) => part.trim());
  const [l, c, h] = (components ?? "").split(/\s+/).map(Number);
  return {
    l: toFiniteNumber(l, 0.5),
    c: toFiniteNumber(c, 0),
    h: toFiniteNumber(h, 0),
    alpha: alphaPart !== undefined ? Number(alphaPart) : undefined,
  };
}

export function formatOklch({ l, c, h, alpha }: Oklch): string {
  const base = `oklch(${round(l)} ${round(c)} ${round(h, 1)})`;
  return alpha === undefined
    ? base
    : `oklch(${round(l)} ${round(c)} ${round(h, 1)} / ${round(alpha)})`;
}

function round(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Nudges lightness by `deltaL`, clamped to a valid OKLCH range. */
function adjustLightness(color: string, deltaL: number): string {
  const oklch = parseOklch(color);
  return formatOklch({ ...oklch, l: clamp(oklch.l + deltaL, 0, 1) });
}

/**
 * Derives a hover-state color: a modest lightness nudge toward the
 * background so the interaction stays legible in both light and dark
 * themes. (Structural default — not a tuned, production-grade hover ramp.)
 */
export function deriveButtonHover(primary: string): string {
  return adjustLightness(primary, -0.08);
}

/** Derives an active/pressed-state color: a stronger nudge than hover. */
export function deriveButtonActive(primary: string): string {
  return adjustLightness(primary, -0.14);
}

/** Derives a subtle input border from the base border token. */
export function deriveInputBorder(border: string): string {
  return adjustLightness(border, -0.04);
}

/** Derives a soft elevation shadow from the foreground token. */
export function deriveCardShadow(foreground: string): string {
  const { h, c } = parseOklch(foreground);
  return `0 1px 2px 0 oklch(0.1 ${round(c * 0.3)} ${round(h, 1)} / 0.08), 0 1px 1px 0 oklch(0.1 ${round(
    c * 0.3,
  )} ${round(h, 1)} / 0.04)`;
}

/** Focus ring width is structurally a derivation (constant default) so it
 * can still be overridden per-theme like any other Tier 2 token. */
export function deriveFocusRingWidth(): string {
  return "2px";
}

/** By default the focus ring re-uses the `ring` Tier 1 token verbatim. */
export function deriveFocusRingColor(ring: string): string {
  return ring;
}

/** Computes the full set of Tier 2 tokens from a Tier 1 token set. */
export function deriveTier2(tier1: Tier1Tokens): Tier2Tokens {
  return {
    buttonHover: deriveButtonHover(tier1.primary),
    buttonActive: deriveButtonActive(tier1.primary),
    cardShadow: deriveCardShadow(tier1.foreground),
    inputBorder: deriveInputBorder(tier1.border),
    focusRingWidth: deriveFocusRingWidth(),
    focusRingColor: deriveFocusRingColor(tier1.ring),
  };
}
