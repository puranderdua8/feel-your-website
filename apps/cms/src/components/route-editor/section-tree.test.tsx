import type { RouteSectionNode } from "@feel-your-website/content-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectionTree } from "./section-tree.js";

const outletNode: RouteSectionNode = {
  instanceId: "outlet-1",
  sectionKey: "outlet",
  content: {},
  slots: {},
};

describe("SectionTree — outlet control", () => {
  it("hides 'Add outlet' when the route isn't a layout", () => {
    render(
      <SectionTree
        tree={[]}
        selectedId={null}
        isLayout={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("+ Add outlet")).toBeNull();
  });

  it("offers 'Add outlet' once the route has children", () => {
    render(
      <SectionTree tree={[]} selectedId={null} isLayout onSelect={vi.fn()} onChange={vi.fn()} />,
    );
    expect(screen.getByText("+ Add outlet")).toBeTruthy();
  });

  it("hides the control once an outlet already exists, however deep", () => {
    render(
      <SectionTree
        tree={[outletNode]}
        selectedId={null}
        isLayout
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("+ Add outlet")).toBeNull();
  });
});
