import { createContext, useContext } from "react";

/**
 * Which bundle a CTA fired from, under the bundle-scoped render model (plan
 * finding 3): a `mode: "action"` button no longer has a page pathname to
 * report — `invokeActionByKey` needs the routeKey + params of the bundle that
 * authored the button, which is whatever `RouteContentView` is currently
 * rendering it.
 */
export interface RouteKeyContextValue {
  readonly routeKey: string;
  readonly params: Readonly<Record<string, string>>;
}

const RouteKeyContext = createContext<RouteKeyContextValue | null>(null);

export const RouteKeyProvider = RouteKeyContext.Provider;

/** Always set within a `RouteContentView` — every CTA renders inside one. */
export function useRouteKey(): RouteKeyContextValue {
  const value = useContext(RouteKeyContext);
  if (!value) throw new Error("useRouteKey() called outside a RouteContentView.");
  return value;
}
