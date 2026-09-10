import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActionCtaSpec } from "./action-cta.js";
import { useFormContext } from "./form-context.js";
import { renderSection } from "./registry.js";

describe("useFormContext", () => {
  it("is null when the section is not inside a form", () => {
    const { result } = renderHook(() => useFormContext());
    expect(result.current).toBeNull();
  });
});

describe("field / form sections", () => {
  it("renders a field's label and a controlled input, empty until the form has a value", () => {
    render(
      renderSection(
        "form",
        { heading: "Subscribe" },
        {
          fields: renderSection(
            "field",
            { name: "email", label: "Email", type: "email" },
            {},
            {
              instanceId: "f1",
            },
          ),
        },
      ),
    );

    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.type).toBe("email");
    expect(input.value).toBe("");
    expect(screen.getByRole("heading", { name: "Subscribe" })).toBeTruthy();
  });

  it("records typed values in the enclosing form's state", () => {
    render(
      renderSection(
        "form",
        {},
        {
          fields: renderSection(
            "field",
            { name: "email", label: "Email" },
            {},
            { instanceId: "f1" },
          ),
        },
      ),
    );

    const input = screen.getByLabelText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a@b.com" } });
    expect(input.value).toBe("a@b.com");
  });

  it("does not submit-navigate: the form swallows its own submit", () => {
    const { container } = render(renderSection("form", { heading: "H" }, {}));
    const form = container.querySelector("form")!;
    const submit = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it("falls back to an uncontrolled input outside a form", () => {
    render(renderSection("field", { name: "x", label: "Loose" }, {}, { instanceId: "f1" }));
    const input = screen.getByLabelText("Loose") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "typed" } });
    // No context to write to, but the section still renders and does not throw.
    expect(input).toBeTruthy();
  });
});

describe("ButtonSection formInput", () => {
  it("forwards the form's current values as formInput when the CTA is inside a form", () => {
    const specs: ActionCtaSpec[] = [];
    render(
      renderSection(
        "form",
        {},
        {
          fields: renderSection(
            "field",
            { name: "email", label: "Email" },
            {},
            { instanceId: "f1" },
          ),
          cta: renderSection(
            "button",
            { label: "Go", mode: "action", actionId: "newsletter.subscribe" },
            {},
            {
              instanceId: "cta-1",
              renderActionCta: (spec) => {
                specs.push(spec);
                return <button type="button">{spec.label}</button>;
              },
            },
          ),
        },
      ),
    );

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });

    const last = specs.at(-1)!;
    expect(last.formInput).toEqual({ email: "a@b.com" });
  });

  it("omits formInput entirely when the CTA is not inside a form", () => {
    const specs: ActionCtaSpec[] = [];
    render(
      renderSection(
        "button",
        { label: "Go", mode: "action", actionId: "newsletter.subscribe" },
        {},
        {
          instanceId: "cta-1",
          renderActionCta: (spec) => {
            specs.push(spec);
            return <button type="button">{spec.label}</button>;
          },
        },
      ),
    );

    expect(specs[0]).not.toHaveProperty("formInput");
  });
});
