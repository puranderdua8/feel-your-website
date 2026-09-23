import { I18nProvider } from "@feel-your-website/i18n-core/react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/help";
vi.mock("@tanstack/react-router", () => ({ useRouterState: () => pathname }));
vi.mock("@/generated/cms-routes.js", () => ({
  CMS_ROUTES: [
    { routeKey: "help", path: "/help", offline: true },
    { routeKey: "blog", path: "/blog", offline: false },
  ],
}));

const { ServiceWorkerNotice } = await import("./service-worker.js");

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, "onLine", { value, configurable: true });
}

function renderNotice() {
  return render(
    <I18nProvider locale="en">
      <ServiceWorkerNotice />
    </I18nProvider>,
  );
}

afterEach(() => {
  setOnline(true);
});

describe("ServiceWorkerNotice", () => {
  it("renders nothing while online", () => {
    setOnline(true);
    const { container } = renderNotice();
    expect(container.firstChild).toBeNull();
  });

  it("shows the generic offline message on a route the build precaches", () => {
    pathname = "/help";
    setOnline(false);
    renderNotice();
    expect(screen.getByText("You are offline. Showing the last saved version.")).toBeTruthy();
  });

  it("shows the 'not available offline' message on a route that isn't precached", () => {
    pathname = "/blog";
    setOnline(false);
    renderNotice();
    expect(screen.getByText("This page isn't available offline.")).toBeTruthy();
  });

  it("shows the 'not available offline' message for a path the build manifest doesn't know at all", () => {
    pathname = "/admin";
    setOnline(false);
    renderNotice();
    expect(screen.getByText("This page isn't available offline.")).toBeTruthy();
  });
});
