import type { RouteSectionNode } from "@feel-your-website/content-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderComposition } from "./compose.js";
import { useRouteParams, type RouteRenderContext } from "./context.js";

const ctx = (over: Partial<RouteRenderContext> = {}): RouteRenderContext => ({
  params: {},
  pathname: "/",
  pattern: "/",
  chain: [],
  locale: "en",
  ...over,
});

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

  it("renders a card with slot children but no own content — `heading` is optional", () => {
    const tree: RouteSectionNode[] = [
      node({
        instanceId: "card",
        sectionKey: "card",
        // No `content` bag at all for this locale, only slot children.
        slots: {
          body: [
            node({
              instanceId: "t",
              sectionKey: "text",
              content: { en: { value: "Just the body" } },
            }),
          ],
        },
      }),
    ];

    render(renderComposition(tree, "en"));

    expect(screen.getByText("Just the body")).toBeTruthy();
    expect(screen.queryByText(/has no content yet/)).toBeNull();
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

  describe("outlet", () => {
    const outletTree: RouteSectionNode[] = [node({ instanceId: "o", sectionKey: "outlet" })];

    it("renders the provided outlet where an `outlet` node sits", () => {
      render(renderComposition(outletTree, "en", { outlet: <span>CHILD</span> }));
      expect(screen.getByText("CHILD")).toBeTruthy();
    });

    it("renders nothing for an `outlet` node when the outlet is explicitly null", () => {
      const { container } = render(renderComposition(outletTree, "en", { outlet: null }));
      expect(container.textContent).toBe("");
    });

    it("renders a placeholder for an `outlet` node when no outlet is passed at all", () => {
      render(renderComposition(outletTree, "en"));
      expect(screen.getByText(/nested route renders here/i)).toBeTruthy();
    });

    it("resolves an `outlet` nested inside a slot", () => {
      const tree: RouteSectionNode[] = [
        node({
          instanceId: "c",
          sectionKey: "card",
          content: { en: { heading: "Wrap" } },
          slots: { body: [node({ instanceId: "o", sectionKey: "outlet" })] },
        }),
      ];
      render(renderComposition(tree, "en", { outlet: <span>DEEP</span> }));
      expect(screen.getByText("Wrap")).toBeTruthy();
      expect(screen.getByText("DEEP")).toBeTruthy();
    });
  });

  it("publishes the route context so descendants (incl. the outlet) can read params", () => {
    function ParamProbe() {
      return <span>slug={useRouteParams().slug ?? "none"}</span>;
    }
    render(
      renderComposition([node({ instanceId: "o", sectionKey: "outlet" })], "en", {
        route: ctx({ params: { slug: "hello" }, pattern: "/blog/:slug" }),
        outlet: <ParamProbe />,
      }),
    );
    expect(screen.getByText("slug=hello")).toBeTruthy();
  });
});
