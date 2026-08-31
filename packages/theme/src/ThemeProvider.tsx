"use client";

import type { ThemeConfig, Tokens } from "@feel-your-website/tokens";
import * as React from "react";

import { compileCssVars } from "./compile-css-vars.js";
import { resolveTheme, type ThemeMode } from "./resolve-theme.js";

export interface ThemeProviderProps {
  /** A registered theme name ("base" | "corporate" | "playful" | ...) or an inline config. */
  theme: string | ThemeConfig;
  /** A one-off override layered on top of the resolved theme. */
  overrides?: ThemeConfig;
  /** Selects the light or dark variant of the base floor. Defaults to "light". */
  mode?: ThemeMode;
  children?: React.ReactNode;
}

interface ThemeContextValue {
  tokens: Tokens;
  mode: ThemeMode;
  themeName: string;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/**
 * Resolves the given theme, compiles it to CSS custom properties, and
 * injects them scoped to a wrapper element via `data-theme`. Because the
 * scoping is a DOM attribute (not a global stylesheet swap), nested or
 * side-by-side themes are possible — a `<ThemeProvider theme="playful">`
 * can be nested inside a `<ThemeProvider theme="corporate">`.
 */
export function ThemeProvider({
  theme,
  overrides,
  mode = "light",
  children,
}: ThemeProviderProps): React.JSX.Element {
  const themeName = typeof theme === "string" ? theme : "custom";

  const tokens = React.useMemo(
    () => resolveTheme(theme, { mode, overrides }),
    [theme, overrides, mode],
  );

  const cssVars = React.useMemo(() => compileCssVars(tokens), [tokens]);

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({ tokens, mode, themeName }),
    [tokens, mode, themeName],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <div
        data-theme={themeName}
        className={mode === "dark" ? "dark" : undefined}
        style={cssVars as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** Reads the resolved tokens (and active mode/theme name) from the nearest `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme() must be used within a <ThemeProvider>");
  }
  return ctx;
}
