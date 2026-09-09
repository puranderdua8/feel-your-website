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
  it("offers 'Add outlet' on any route without one, children or not", () => {
    render(
      <SectionTree
        tree={[]}
        selectedId={null}
        hasChildRoutes={false}
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("+ Add outlet")).toBeTruthy();
  });

  it("hides the control once an outlet already exists, however deep", () => {
    render(
      <SectionTree
        tree={[outletNode]}
        selectedId={null}
        hasChildRoutes
        onSelect={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("+ Add outlet")).toBeNull();
  });
});
