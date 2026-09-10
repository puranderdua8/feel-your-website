// The SSR-safe core. The React `<ConsentProvider>` / `useConsent()` live in the
// `./react` entry so their `"use client"` directive is the first line of its
// own compiled output rather than buried in a bundle that also holds this
// server-safe code.
export * from "./consent.js";
