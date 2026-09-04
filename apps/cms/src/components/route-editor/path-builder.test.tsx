import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PathBuilder } from "./path-builder.js";

describe("PathBuilder", () => {
  it("renders a root route's segment and emits the edited path", () => {
    const onChange = vi.fn();
    render(<PathBuilder parentPath={null} pathSegment="/blog" onChange={onChange} />);

    const input = screen.getByPlaceholderText("about") as HTMLInputElement;
    expect(input.value).toBe("blog");

    fireEvent.change(input, { target: { value: "docs" } });
    expect(onChange).toHaveBeenLastCalledWith("/docs");
  });

  it("shows the locked parent prefix and edits only the one child segment", () => {
    render(<PathBuilder parentPath="/docs" pathSegment=":slug" onChange={vi.fn()} />);

    expect(screen.getByText("/docs/")).toBeTruthy();
    // A nested route always keeps exactly one segment — no "+ segment" control.
    expect(screen.queryByText("+ segment")).toBeNull();
    // And it renders the param's bare name (no leading colon) in the field.
    expect((screen.getByPlaceholderText("slug") as HTMLInputElement).value).toBe("slug");
  });

  it("offers to add more segments only on a root route", () => {
    render(<PathBuilder parentPath={null} pathSegment="/docs" onChange={vi.fn()} />);
    expect(screen.getByText("+ segment")).toBeTruthy();
  });

  it("renders `/` for a root route with no segments yet", () => {
    render(<PathBuilder parentPath={null} pathSegment="/" onChange={vi.fn()} />);
    expect(screen.getByText("/")).toBeTruthy();
  });

  it("still shows one editable segment for a brand-new child with an empty pathSegment", () => {
    // Regression: an empty single segment and zero segments both serialise to
    // `""`, so the row can't be gated behind "+ segment" the way a root's can
    // — it must render unconditionally, or a new child route can never get
    // its first segment typed in.
    const onChange = vi.fn();
    render(<PathBuilder parentPath="/blog" pathSegment="" onChange={onChange} />);

    const input = screen.getByPlaceholderText("about") as HTMLInputElement;
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { value: "reviews" } });
    expect(onChange).toHaveBeenLastCalledWith("reviews");
  });

  it("recovers from a transient root-shaped value on a child (e.g. right after reparenting)", () => {
    // `index.tsx` resets `pathSegment` itself when `parentId` crosses the
    // root/child boundary, but the component must not render `(invalid)`
    // garbage if it's ever handed the wrong shape for a beat.
    render(<PathBuilder parentPath="/blog" pathSegment="/" onChange={vi.fn()} />);
    expect(screen.queryByText("+ segment")).toBeNull();
    expect((screen.getByPlaceholderText("about") as HTMLInputElement).value).toBe("");
  });
});
