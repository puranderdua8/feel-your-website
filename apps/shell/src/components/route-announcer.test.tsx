import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { RouteAnnouncer } from "./route-announcer";

function renderApp() {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Link to="/help">About</Link>
        <Link to="/releases">Plain</Link>
        <Link to="/help" hash="team">
          Team
        </Link>
        <Link to="/" search={{ q: "x" } as never}>
          Filter
        </Link>
        <Outlet />
        <RouteAnnouncer />
      </>
    ),
  });
  const page = (path: string, body: ReactNode) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <main>{body}</main> });
  const routeTree = rootRoute.addChildren([
    page("/", <h1>Home</h1>),
    page(
      "/help",
      <>
        <h1>About us</h1>
        <h2 id="team">Team</h2>
      </>,
    ),
    page("/releases", <p>No heading here</p>),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("link", { name }), { button: 0 });
  });
}

beforeEach(() => {
  // jsdom has no layout; the router scrolls on navigation (and to a hash target).
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  document.title = "";
});

describe("RouteAnnouncer", () => {
  it("leaves focus alone on the initial load", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "Home" });
    expect(document.activeElement).toBe(document.body);
  });

  it("moves focus to the new page's h1 and announces the title", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "Home" });
    document.title = "About — site";
    await click("About");

    const heading = await screen.findByRole("heading", { name: "About us" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("status").textContent).toBe("About — site");
  });

  it("falls back to <main> when the page has no h1", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "Home" });
    await click("Plain");

    await screen.findByText("No heading here");
    await waitFor(() => expect(document.activeElement?.tagName).toBe("MAIN"));
  });

  it("focuses the fragment's target when the new URL has one", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "Home" });
    await click("Team");

    const team = await screen.findByRole("heading", { name: "Team" });
    await waitFor(() => expect(document.activeElement).toBe(team));
  });

  it("does not steal focus on a same-path (query-only) change", async () => {
    const router = renderApp();
    await screen.findByRole("heading", { name: "Home" });
    const filter = screen.getByRole("link", { name: "Filter" });
    filter.focus();
    await click("Filter");

    await waitFor(() => expect(router.state.location.search).toEqual({ q: "x" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(filter);
  });
});
