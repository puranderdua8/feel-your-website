// Deliberately server-safe only: no "use client" component lives on this
// entry point. `ThemeProvider`/`useTheme` are exported from "./client" (a
// separate tsup entry) so their "use client" directive survives bundling as
// the first line of its own output file. Bundling them into this same file
// silently dropped the directive, which broke every RSC-based consumer
// (e.g. Next.js App Router) with "createContext is not a function" — see
// ADR note in README. Keep this split.
export * from "./resolve-theme.js";
export * from "./compile-css-vars.js";
export * from "./themes/index.js";
