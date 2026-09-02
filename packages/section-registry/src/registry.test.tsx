import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderTemplate } from "./registry.js";

describe("renderTemplate", () => {
  it("renders the hero template's title and subtitle", () => {
    render(
      renderTemplate("hero", {
        templateKey: "hero",
        variant: "",
        locale: "en",
        translated: true,
        fields: { title: "Welcome", subtitle: "Glad you're here" },
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    expect(screen.getByRole("heading", { name: "Welcome" })).toBeTruthy();
    expect(screen.getByText("Glad you're here")).toBeTruthy();
  });

  it("renders guidance and help through the same title/body template", () => {
    const content = {
      templateKey: "guidance",
      variant: "",
      locale: "en",
      translated: true,
      fields: { title: "Guidance", body: "Hold the device close." },
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const { unmount } = render(renderTemplate("guidance", content));
    expect(screen.getByText("Hold the device close.")).toBeTruthy();
    unmount();

    render(renderTemplate("help", { ...content, templateKey: "help" }));
    expect(screen.getByText("Hold the device close.")).toBeTruthy();
  });

  it("renders visibly, not silently, when the template key is unregistered", () => {
    render(
      renderTemplate("not-a-real-template", {
        templateKey: "not-a-real-template",
        variant: "",
        locale: "en",
        translated: true,
        fields: {},
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    expect(screen.getByText(/No template registered/)).toBeTruthy();
  });

  it("renders visibly, not silently, when content is missing", () => {
    render(renderTemplate("hero", null));

    expect(screen.getByText(/has no content yet/)).toBeTruthy();
  });
});
