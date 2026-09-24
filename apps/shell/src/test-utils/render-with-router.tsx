import {
  type AnyRouter,
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, type RenderResult, screen } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Renders `ui` inside a real TanStack router (memory history, one root route
 * that matches every path), so `<Link>` behaves as it does in the app —
 * real `href`s, real client-side transitions — without mocking the router.
 * Resolves once the first render has committed.
 */
export async function renderWithRouter(
  ui: ReactNode,
  initialPath = "/",
): Promise<RenderResult & { router: AnyRouter }> {
  // jsdom has no layout; the router's scroll restoration calls this on navigation.
  window.scrollTo = () => {};
  const rootRoute = createRootRoute({ component: () => <>{ui}</>, notFoundComponent: () => null });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const result = render(<RouterProvider router={router} />);
  await screen.findAllByRole("link");
  return { router, ...result };
}
