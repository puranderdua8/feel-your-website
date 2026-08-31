"use client";

import * as React from "react";

import { can } from "./resolve.js";
import type { PermissionSet } from "./types.js";

const PermissionsContext = React.createContext<PermissionSet | null>(null);

export interface PermissionsProviderProps {
  /**
   * The subject's resolved permission set. Resolved server-side and passed
   * down — the client never derives it from roles, because a client-side
   * decision is a display decision, not an access-control one.
   */
  permissions: PermissionSet;
  children?: React.ReactNode;
}

export function PermissionsProvider({
  permissions,
  children,
}: PermissionsProviderProps): React.JSX.Element {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

/** Reads the resolved permission set from the nearest provider. */
export function usePermissions(): PermissionSet {
  const context = React.useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions() must be used within a <PermissionsProvider>");
  }
  return context;
}

/**
 * Whether the current subject holds this permission.
 *
 * This gates *rendering* only. Every permission it hides must also be
 * enforced server-side — hiding a button does not protect the endpoint
 * behind it.
 */
export function useCan<TPermission extends string = string>(permission: TPermission): boolean {
  const permissions = usePermissions();
  return can(permissions as PermissionSet<TPermission>, permission);
}

export interface CanProps<TPermission extends string = string> {
  permission: TPermission;
  /**
   * Rendered when the permission is absent. Defaults to nothing.
   *
   * Prefer passing explanatory copy over silently vanishing: telling someone
   * a feature exists but is not available to them is usually better UX than
   * a gap where a control should be.
   */
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

/** Renders `children` only when the permission is held. */
export function Can<TPermission extends string = string>({
  permission,
  fallback = null,
  children,
}: CanProps<TPermission>): React.JSX.Element {
  const allowed = useCan(permission);
  return <>{allowed ? children : fallback}</>;
}
