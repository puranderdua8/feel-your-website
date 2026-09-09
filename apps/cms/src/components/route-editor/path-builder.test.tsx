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

  it("offers '+ segment' only on a root route, once the last row has text", () => {
    render(<PathBuilder parentPath={null} pathSegment="/docs" onChange={vi.fn()} />);
    expect((screen.getByText("+ segment") as HTMLButtonElement).disabled).toBe(false);
  });

  it("still shows one editable segment for a brand-new ROOT with an empty pathSegment", () => {
    // Regression: `/` (no segments) and `/` (one empty segment) serialise
    // identically, so a row gated behind "+ segment" could never be reached and
    // a top-level route was uncreatable through the UI. The row must render
    // unconditionally; "+ segment" stays disabled until it has text.
    const onChange = vi.fn();
    render(<PathBuilder parentPath={null} pathSegment="/" onChange={onChange} />);

    const input = screen.getByPlaceholderText("about") as HTMLInputElement;
    expect(input.value).toBe("");
    expect((screen.getByText("+ segment") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "home" } });
    expect(onChange).toHaveBeenLastCalledWith("/home");
  });

  it("adds a second root segment once the first has text", () => {
    const onChange = vi.fn();
    render(<PathBuilder parentPath={null} pathSegment="/docs" onChange={onChange} />);

    fireEvent.click(screen.getByText("+ segment"));
    // A trailing empty segment the author is about to fill.
    expect(onChange).toHaveBeenLastCalledWith("/docs/");
  });

  it("still shows one editable segment for a brand-new child with an empty pathSegment", () => {
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
