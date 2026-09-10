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

  it("renders an action-mode button as a disabled placeholder without a host renderer", () => {
    render(
      renderSection("button", {
        label: "Subscribe",
        mode: "action",
        actionId: "newsletter.subscribe",
      }),
    );

    const cta = screen.getByText("Subscribe");
    expect(cta.getAttribute("aria-disabled")).toBe("true");
  });

  it("hands an action-mode button to renderActionCta with the instance id and authored body", () => {
    const seen: unknown[] = [];
    render(
      renderSection(
        "button",
        {
          label: "Subscribe",
          mode: "action",
          actionId: "newsletter.subscribe",
          successLabel: "Done",
          body: { email: { source: "routeParam", value: "slug" } },
        },
        {},
        {
          instanceId: "cta-1",
          renderActionCta: (spec) => {
            seen.push(spec);
            return <button type="button">{spec.label}</button>;
          },
        },
      ),
    );

    expect(screen.getByRole("button", { name: "Subscribe" })).toBeTruthy();
    expect(seen).toEqual([
      {
        instanceId: "cta-1",
        actionId: "newsletter.subscribe",
        label: "Subscribe",
        successLabel: "Done",
        body: { email: { source: "routeParam", value: "slug" } },
        className: expect.any(String),
      },
    ]);
  });

  it("renders a skeleton for release-feed while its data is `{ pending: true }`", () => {
    const { container } = render(
      renderSection("release-feed", { heading: "Latest" }, {}, { data: { pending: true } }),
    );
    // Skeleton bars, no fallback line, no list of releases.
    expect(container.querySelectorAll(".bg-muted").length).toBeGreaterThan(0);
    expect(screen.queryByText(/unavailable right now/)).toBeNull();
  });

  it("renders the release-feed fallback for an absent entry", () => {
    render(renderSection("release-feed", { heading: "Latest" }));
    expect(screen.getByText(/unavailable right now/)).toBeTruthy();
  });
});
