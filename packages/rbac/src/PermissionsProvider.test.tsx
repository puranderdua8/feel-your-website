import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Can, PermissionsProvider, useCan } from "./react.js";

const granted = new Set(["capture:audio", "view:analytics"]);

function Probe({ permission }: { permission: string }) {
  return <span>{useCan(permission) ? "yes" : "no"}</span>;
}

describe("PermissionsProvider", () => {
  it("useCan reflects the resolved set", () => {
    const { rerender } = render(
      <PermissionsProvider permissions={granted}>
        <Probe permission="capture:audio" />
      </PermissionsProvider>,
    );
    expect(screen.getByText("yes")).toBeTruthy();

    rerender(
      <PermissionsProvider permissions={granted}>
        <Probe permission="manage:content" />
      </PermissionsProvider>,
    );
    expect(screen.getByText("no")).toBeTruthy();
  });

  it("throws outside a provider rather than defaulting to allowed", () => {
    // Failing closed is not enough here — a silent `false` would hide a
    // wiring bug, so an unconfigured tree must be loud.
    expect(() => render(<Probe permission="capture:audio" />)).toThrow(
      /must be used within a <PermissionsProvider>/,
    );
  });
});

describe("Can", () => {
  const wrap = (ui: React.ReactNode) =>
    render(<PermissionsProvider permissions={granted}>{ui}</PermissionsProvider>);

  it("renders children when the permission is held", () => {
    wrap(<Can permission="capture:audio">allowed</Can>);
    expect(screen.getByText("allowed")).toBeTruthy();
  });

  it("renders nothing by default when it is not", () => {
    const { container } = wrap(<Can permission="manage:content">allowed</Can>);
    expect(container.textContent).toBe("");
  });

  it("renders the fallback when provided", () => {
    wrap(
      <Can permission="manage:content" fallback={<span>locked</span>}>
        allowed
      </Can>,
    );
    expect(screen.getByText("locked")).toBeTruthy();
    expect(screen.queryByText("allowed")).toBeNull();
  });
});
