import type { RouteSectionNode } from "@feel-your-website/content-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderComposition } from "./compose.js";

const node = (
  over: Partial<RouteSectionNode> & Pick<RouteSectionNode, "instanceId" | "sectionKey">,
): RouteSectionNode => ({ content: {}, slots: {}, ...over });

describe("renderComposition", () => {
  it("renders roots in order, from each node's own content", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "h",
        sectionKey: "hero",
        content: { en: { title: "Top" } },
      }),
      node({
        instanceId: "f",
        sectionKey: "footer",
        content: { en: { text: "Bottom" } },
      }),
    ];

    render(renderComposition(tree, "en"));

    expect(screen.getByRole("heading", { name: "Top" })).toBeTruthy();
    expect(screen.getByText("Bottom")).toBeTruthy();
  });

  it("renders slot children inside their parent", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        sectionKey: "card",
        content: { en: { heading: "Card A" } },
        slots: {
          icon: [
            node({
              instanceId: "ic",
              sectionKey: "icon",
              content: { en: { name: "star" } },
            }),
          ],
          body: [
            node({
              instanceId: "t",
              sectionKey: "text",
              content: { en: { value: "Body copy" } },
            }),
          ],
        },
      }),
    ];

    render(renderComposition(tree, "en"));

    expect(screen.getByText("Card A")).toBeTruthy();
    expect(screen.getByText("Body copy")).toBeTruthy();
    expect(screen.getByText("star")).toBeTruthy();
  });

  it("renders a card with empty slots — they simply contribute nothing", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        sectionKey: "card",
        content: { en: { heading: "Bare" } },
      }),
    ];

    render(renderComposition(tree, "en"));

    expect(screen.getByText("Bare")).toBeTruthy();
  });

  it("renders a visible placeholder when a node has no content for the locale", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "h",
        sectionKey: "hero",
        content: { en: { title: "English only" } },
      }),
    ];

    render(renderComposition(tree, "hi"));

    expect(screen.getByText(/has no content yet/)).toBeTruthy();
  });
});
