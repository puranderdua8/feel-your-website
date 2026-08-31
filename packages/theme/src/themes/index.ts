import type { ThemeConfig } from "@feel-your-website/tokens";

import { base } from "./base.js";
import { corporate } from "./corporate.js";
import { playful } from "./playful.js";

/**
 * All named themes. Adding a new theme later is one file + one registry
 * entry here — nothing else in the system needs to change.
 */
export const themeRegistry: Record<string, ThemeConfig> = {
  base,
  corporate,
  playful,
};

export type ThemeName = keyof typeof themeRegistry;

export { base, baseDark } from "./base.js";
export { corporate } from "./corporate.js";
export { playful } from "./playful.js";
