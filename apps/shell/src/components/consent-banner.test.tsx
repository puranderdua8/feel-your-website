import { ConsentProvider } from "@feel-your-website/consent-core/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsentBanner } from "./consent-banner";

afterEach(() => {
  window.localStorage.clear();
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
});

const renderBanner = (initial?: "unknown" | "granted" | "denied") =>
  render(
    <ConsentProvider initial={initial}>
      <ConsentBanner />
    </ConsentProvider>,
  );

describe("ConsentBanner", () => {
  it("shows while the choice is unknown", () => {
    renderBanner("unknown");
    expect(screen.getByRole("dialog", { name: /consent/i })).toBeTruthy();
  });

  it("is hidden once a choice is stored", () => {
    window.localStorage.setItem("fyw.consent", "denied");
    renderBanner("denied");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Accept persists granted and dismisses the banner", () => {
    renderBanner("unknown");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(window.localStorage.getItem("fyw.consent")).toBe("granted");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Decline persists denied and dismisses the banner", () => {
    renderBanner("unknown");
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(window.localStorage.getItem("fyw.consent")).toBe("denied");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
