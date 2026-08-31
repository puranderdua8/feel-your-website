/**
 * Tier 0 — raw, non-semantic color primitives.
 *
 * Each ramp is a set of OKLCH lightness steps for one hue family. Nothing in
 * this file has semantic meaning ("primary", "destructive", etc.) — that
 * mapping happens at Tier 1, in a theme.
 */

export type ColorStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export type ColorRamp = Record<ColorStep, string>;

const steps: ColorStep[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Builds an OKLCH ramp from a peak chroma/hue, using a fixed lightness curve.
 * Not perceptually perfect — good enough to give every ramp a consistent
 * shape without hand-authoring 11 stops per hue.
 */
function buildRamp(hue: number, peakChroma: number): ColorRamp {
  const lightnessByStep: Record<ColorStep, number> = {
    50: 0.98,
    100: 0.95,
    200: 0.9,
    300: 0.82,
    400: 0.72,
    500: 0.6,
    600: 0.5,
    700: 0.42,
    800: 0.34,
    900: 0.26,
    950: 0.17,
  };

  // Chroma tapers toward the extremes so 50/950 stay usable as
  // near-white / near-black rather than fully saturated.
  const chromaCurve: Record<ColorStep, number> = {
    50: 0.02,
    100: 0.04,
    200: 0.06,
    300: 0.09,
    400: 0.12,
    500: 1,
    600: 0.95,
    700: 0.85,
    800: 0.65,
    900: 0.45,
    950: 0.25,
  };

  return steps.reduce((ramp, step) => {
    const lightness = lightnessByStep[step];
    const chroma = +(peakChroma * chromaCurve[step]).toFixed(3);
    ramp[step] = `oklch(${lightness} ${chroma} ${hue})`;
    return ramp;
  }, {} as ColorRamp);
}

export const gray: ColorRamp = buildRamp(260, 0.02);
export const blue: ColorRamp = buildRamp(258, 0.19);
export const red: ColorRamp = buildRamp(25, 0.21);
export const green: ColorRamp = buildRamp(150, 0.17);
export const amber: ColorRamp = buildRamp(80, 0.18);
export const violet: ColorRamp = buildRamp(295, 0.2);

export const colorPrimitives = {
  gray,
  blue,
  red,
  green,
  amber,
  violet,
} as const;

export type ColorPrimitives = typeof colorPrimitives;
