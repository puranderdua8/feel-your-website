"use client";

// Separate entry point (see index.ts) so this directive is the first line of
// its own compiled output file, not buried inside a bundle that also
// contains server-safe code. Import as `@feel-your-website/theme/client`.
export { ThemeProvider, useTheme } from "./ThemeProvider.js";
export type { ThemeProviderProps } from "./ThemeProvider.js";
