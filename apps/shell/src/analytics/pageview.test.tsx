import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const usePageview = vi.fn();
vi.mock("@feel-your-website/analytics-core/react", () => ({
  usePageview: (path: string | null) => usePageview(path),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/blog/hello" } }),
}));

const { PageviewTracker } = await import("./pageview.js");

describe("PageviewTracker", () => {
  it("feeds the resolved pathname into usePageview and renders nothing", () => {
    const { container } = render(<PageviewTracker />);
    expect(usePageview).toHaveBeenCalledWith("/blog/hello");
    expect(container.innerHTML).toBe("");
  });
});
