import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderSectionSample } from "./sample.js";
import { sectionCatalog } from "./sections.js";

describe("renderSectionSample", () => {
  it("renders a leaf section with its sample fields", () => {
    render(renderSectionSample(sectionCatalog.byKey.get("hero")!));

    expect(screen.getByRole("heading", { name: "Feel your website" })).toBeTruthy();
  });

  it("renders a composite section with its sample slot children", () => {
    render(renderSectionSample(sectionCatalog.byKey.get("card")!));

    expect(screen.getByRole("heading", { name: "Card heading" })).toBeTruthy();
    expect(screen.getByText("Body text inside the card.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Learn more" })).toBeTruthy();
  });

  it("falls back to the registry placeholder when a section has no sample", () => {
    render(renderSectionSample({ key: "hero", description: "", fields: [], slots: [] }));

    expect(screen.getByText(/has no content yet/)).toBeTruthy();
  });
});
