/**
 * Tier 0 — raw border-radius scale.
 */
export const radius = {
  none: "0rem",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export type RadiusScale = typeof radius;
export type RadiusKey = keyof RadiusScale;
