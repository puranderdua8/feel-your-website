import type { ActionCtaSpec } from "@feel-your-website/section-registry";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const invokeAction = vi.fn();
vi.mock("@/server/bff", () => ({ invokeAction: (...args: unknown[]) => invokeAction(...args) }));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ state: { location: { pathname: "/n/hello" } } }),
}));

const { ButtonActionForm } = await import("./button-action-form.js");

const spec = (over: Partial<ActionCtaSpec> = {}): ActionCtaSpec => ({
  instanceId: "cta-1",
  actionId: "newsletter.subscribe",
  label: "Subscribe",
  successLabel: "Subscribed",
  body: {},
  className: "cta",
  ...over,
});

afterEach(() => {
  invokeAction.mockReset();
  vi.unstubAllGlobals();
});

describe("ButtonActionForm", () => {
  it("renders an enabled button and an empty status region", () => {
    render(<ButtonActionForm spec={spec()} />);
    const button = screen.getByRole("button", { name: "Subscribe" });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("on success shows the success label, keeps the button disabled, and announces", async () => {
    invokeAction.mockResolvedValue({ ok: true, data: {} });
    render(<ButtonActionForm spec={spec()} />);

    screen.getByRole("button", { name: "Subscribe" }).click();

    const button = await screen.findByRole("button", { name: "Subscribed" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Subscribed");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("status")));

    button.click();
    expect(invokeAction).toHaveBeenCalledTimes(1); // stays disabled after success
  });

  it("sends only the pathname, instanceId and a requestId", async () => {
    invokeAction.mockResolvedValue({ ok: true, data: {} });
    render(<ButtonActionForm spec={spec()} />);
    screen.getByRole("button", { name: "Subscribe" }).click();
    await screen.findByRole("button", { name: "Subscribed" });

    expect(invokeAction).toHaveBeenCalledWith({
      data: {
        path: "/n/hello",
        instanceId: "cta-1",
        requestId: expect.stringMatching(/.+/),
      },
    });
  });

  it("shows a normalised message for a failure code and re-enables the button", async () => {
    invokeAction.mockResolvedValue({ ok: false, code: "forbidden" });
    render(<ButtonActionForm spec={spec()} />);
    screen.getByRole("button", { name: "Subscribe" }).click();

    expect(await screen.findByText(/do not have permission/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe" }).hasAttribute("disabled")).toBe(false);
  });

  it("lists field issues on an invalid_request", async () => {
    invokeAction.mockResolvedValue({
      ok: false,
      code: "invalid_request",
      issues: [{ field: "email", message: "Email is required." }],
    });
    render(<ButtonActionForm spec={spec()} />);
    screen.getByRole("button", { name: "Subscribe" }).click();

    expect(await screen.findByText(/email: Email is required\./)).toBeTruthy();
  });

  it("disables the button and sets aria-busy while the call is in flight", async () => {
    let resolve!: (v: unknown) => void;
    invokeAction.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ButtonActionForm spec={spec()} />);

    const button = screen.getByRole("button", { name: "Subscribe" });
    button.click();

    await waitFor(() => expect(button.getAttribute("aria-busy")).toBe("true"));
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Working");

    resolve({ ok: true, data: {} });
    await screen.findByRole("button", { name: "Subscribed" });
  });

  it("uses a fresh requestId on a retry after an error", async () => {
    invokeAction.mockResolvedValue({ ok: false, code: "unavailable" });
    render(<ButtonActionForm spec={spec()} />);

    screen.getByRole("button", { name: "Subscribe" }).click();
    await screen.findByText(/unavailable/i);
    screen.getByRole("button", { name: "Subscribe" }).click();
    await waitFor(() => expect(invokeAction).toHaveBeenCalledTimes(2));

    const first = invokeAction.mock.calls[0]![0].data.requestId;
    const second = invokeAction.mock.calls[1]![0].data.requestId;
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it("asks for confirmation for a confirm action and does nothing if declined", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    render(<ButtonActionForm spec={spec({ actionId: "webhook.trigger", label: "Fire" })} />);

    screen.getByRole("button", { name: "Fire" }).click();
    expect(window.confirm).toHaveBeenCalled();
    expect(invokeAction).not.toHaveBeenCalled();
  });

  it("proceeds when confirmation is accepted", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    invokeAction.mockResolvedValue({ ok: true, data: {} });
    render(<ButtonActionForm spec={spec({ actionId: "webhook.trigger", label: "Fire" })} />);

    screen.getByRole("button", { name: "Fire" }).click();
    await waitFor(() => expect(invokeAction).toHaveBeenCalledTimes(1));
  });

  it("shows the generic error when the call throws", async () => {
    invokeAction.mockRejectedValue(new Error("network"));
    render(<ButtonActionForm spec={spec()} />);
    screen.getByRole("button", { name: "Subscribe" }).click();

    expect(await screen.findByText(/unavailable right now/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Subscribe" }).hasAttribute("disabled")).toBe(false);
  });
});
