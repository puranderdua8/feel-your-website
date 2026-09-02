import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderSection } from "./registry.js";

describe("renderSection", () => {
  it("renders the hero section's title and subtitle from its field bag", () => {
    render(renderSection("hero", { title: "Welcome", subtitle: "Glad you're here" }));

    expect(screen.getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.getByText("Glad you're here")).toBeTruthy();
  });

  it("renders guidance and help through the same title/body component", () => {
    const fields = { title: "Guidance", body: "Hold the device close." };

    const { unmount } = render(renderSection("guidance", fields));
    expect(screen.getByText("Hold the device close.")).toBeTruthy();
    unmount();

    render(renderSection("help", fields));
    expect(screen.getByText("Hold the device close.")).toBeTruthy();
  });

  it("renders visibly, not silently, when the section key is unregistered", () => {
    render(renderSection("not-a-real-section", {}));

    expect(screen.getByText(/No section registered/)).toBeTruthy();
  });

  it("renders visibly, not silently, when content is missing", () => {
    render(renderSection("hero", null));

    expect(screen.getByText(/has no content yet/)).toBeTruthy();
  });
});
