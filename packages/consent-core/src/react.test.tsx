import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CONSENT_COOKIE_NAME } from "./consent.js";
import { ConsentProvider, useConsent } from "./react.js";

afterEach(() => {
  window.localStorage.clear();
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
  vi.unstubAllGlobals();
});

function wrapper(initial?: "unknown" | "granted" | "denied") {
  return function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <ConsentProvider initial={initial}>{children}</ConsentProvider>;
  };
}

describe("ConsentProvider / useConsent", () => {
  it("throws when used outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useConsent())).toThrow(/within a <ConsentProvider>/);
  });

  it("keeps the SSR seed when client storage agrees, and becomes ready", () => {
    // SSR seeded `granted` from the cookie; the client re-reads the same cookie.
    document.cookie = `${CONSENT_COOKIE_NAME}=granted; path=/`;
    const { result } = renderHook(() => useConsent(), { wrapper: wrapper("granted") });
    expect(result.current.status).toBe("granted");
    expect(result.current.ready).toBe(true);
  });

  it("corrects the SSR seed when client storage disagrees", () => {
    // e.g. the cookie was cleared in this tab since the server rendered.
    const { result } = renderHook(() => useConsent(), { wrapper: wrapper("granted") });
    expect(result.current.status).toBe("unknown");
  });

  it("adopts a stored choice on mount", () => {
    window.localStorage.setItem("fyw.consent", "denied");
    const { result } = renderHook(() => useConsent(), { wrapper: wrapper("unknown") });
    expect(result.current.status).toBe("denied");
  });

  it("setConsent persists and updates the status", () => {
    const { result } = renderHook(() => useConsent(), { wrapper: wrapper() });

    act(() => result.current.setConsent("granted"));
    expect(result.current.status).toBe("granted");
    expect(window.localStorage.getItem("fyw.consent")).toBe("granted");
    expect(document.cookie).toContain(`${CONSENT_COOKIE_NAME}=granted`);
  });

  it("forces denied and refuses a granting call when a privacy signal is set", () => {
    vi.stubGlobal("navigator", { globalPrivacyControl: true });
    window.localStorage.setItem("fyw.consent", "granted");

    const { result } = renderHook(() => useConsent(), { wrapper: wrapper("granted") });
    expect(result.current.status).toBe("denied");

    act(() => result.current.setConsent("granted"));
    expect(result.current.status).toBe("denied");
  });

  it("renders its children", () => {
    render(
      <ConsentProvider>
        <span>hello</span>
      </ConsentProvider>,
    );
    expect(screen.getByText("hello")).toBeTruthy();
  });
});
