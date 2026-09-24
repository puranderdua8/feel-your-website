import type { RouteSectionNode } from "@feel-your-website/content-core";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoutePreview } from "./route-preview";

const buttonNode = (href: string): RouteSectionNode =>
  ({
    instanceId: "cta-1",
    sectionKey: "button",
    content: { en: { label: "Read more", mode: "link", href } },
    slots: {},
  }) as unknown as RouteSectionNode;

describe("RoutePreview", () => {
  it("shows a CTA's target but never follows it out of the editor", () => {
    render(<RoutePreview tree={[buttonNode("/blog/hello?ref=cta#comments")]} locale="en" />);
    const link = screen.getByRole("link", { name: "Read more" });
    expect(link.getAttribute("href")).toBe("/blog/hello?ref=cta#comments");
    expect(link.getAttribute("title")).toBe("/blog/hello?ref=cta#comments");

    const click = createEvent.click(link, { button: 0 });
    fireEvent(link, click);
    expect(click.defaultPrevented).toBe(true);
  });
});
