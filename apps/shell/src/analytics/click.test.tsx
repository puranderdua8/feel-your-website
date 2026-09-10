import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useClickTracking = vi.fn();
vi.mock("@feel-your-website/analytics-core/react", () => ({
  useClickTracking: (opts: unknown) => useClickTracking(opts),
}));
vi.mock("@feel-your-website/section-registry", () => ({
  classifyHref: (href: string) => ({ kind: href.startsWith("/") ? "internal" : "external", href }),
}));

const { ClickTracker } = await import("./click.js");

describe("ClickTracker", () => {
  it("wires useClickTracking with a section-registry-backed href classifier", () => {
    const { container } = render(<ClickTracker />);
    expect(container.innerHTML).toBe("");

    const opts = useClickTracking.mock.calls[0]![0] as { classifyHref: (h: string) => string };
    expect(opts.classifyHref("/about")).toBe("internal");
    expect(opts.classifyHref("https://x.test")).toBe("external");
  });
});
