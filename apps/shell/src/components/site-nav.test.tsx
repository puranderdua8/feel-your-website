import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { NavNode } from "@/server/bff";
import { renderWithRouter } from "@/test-utils/render-with-router";

import { SiteNav } from "./site-nav";

const node = (id: string, path: string, title: string, children: NavNode[] = []): NavNode => ({
  id,
  path,
  title,
  children,
});

const nav: NavNode[] = [
  node("help", "/help", "Help"),
  node("blog", "/blog", "Blog", [node("releases", "/blog/releases", "Releases")]),
];

describe("SiteNav", () => {
  it("navigates client-side from a top-level entry and marks it current", async () => {
    const { router } = await renderWithRouter(<SiteNav nav={nav} />);
    const help = screen.getByRole("link", { name: "Help" });
    expect(help.getAttribute("href")).toBe("/help");

    fireEvent.click(help, { button: 0 });
    await waitFor(() => expect(router.state.location.pathname).toBe("/help"));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Help" }).getAttribute("aria-current")).toBe("page"),
    );
  });

  it("navigates client-side from a dropdown entry", async () => {
    const { router } = await renderWithRouter(<SiteNav nav={nav} />);
    fireEvent.click(screen.getByRole("button", { name: "Blog" }));
    const releases = await screen.findByRole("link", { name: "Releases" });
    expect(releases.getAttribute("href")).toBe("/blog/releases");

    fireEvent.click(releases, { button: 0 });
    await waitFor(() => expect(router.state.location.pathname).toBe("/blog/releases"));
  });
});
