import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithRouter } from "@/test-utils/render-with-router";

import { AppLink } from "./app-link";

describe("AppLink", () => {
  it("renders a plain path as a router link", async () => {
    await renderWithRouter(<AppLink to="/about">About</AppLink>);
    expect(screen.getByRole("link", { name: "About" }).getAttribute("href")).toBe("/about");
  });

  it("round-trips an authored query and fragment exactly", async () => {
    await renderWithRouter(
      <AppLink route={{ pathname: "/blog/hello", search: "?page=2&ref=cta", hash: "comments" }}>
        Read
      </AppLink>,
    );
    expect(screen.getByRole("link", { name: "Read" }).getAttribute("href")).toBe(
      "/blog/hello?page=2&ref=cta#comments",
    );
  });

  it("navigates client-side on a plain click", async () => {
    const { router } = await renderWithRouter(
      <AppLink route={{ pathname: "/blog/hello", search: "?page=2", hash: "" }}>Read</AppLink>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Read" }), { button: 0 });
    await waitFor(() => expect(router.state.location.href).toBe("/blog/hello?page=2"));
  });

  it("passes anchor props through (for Radix asChild)", async () => {
    await renderWithRouter(
      <AppLink to="/about" className="nav" data-testid="x">
        About
      </AppLink>,
    );
    const anchor = screen.getByTestId("x");
    expect(anchor.className).toContain("nav");
  });

  it("marks the link to the current location active", async () => {
    await renderWithRouter(<AppLink to="/about">About</AppLink>, "/about");
    expect(screen.getByRole("link", { name: "About" }).getAttribute("aria-current")).toBe("page");
  });
});
