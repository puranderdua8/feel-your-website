"use client";

// Separate entry point (see index.ts) so this directive is the first line of
// its own compiled output file, not buried inside a bundle that also holds
// server-safe code. Import as `@feel-your-website/rbac/react`.
export { PermissionsProvider, usePermissions, useCan, Can } from "./PermissionsProvider.js";
export type { PermissionsProviderProps, CanProps } from "./PermissionsProvider.js";
