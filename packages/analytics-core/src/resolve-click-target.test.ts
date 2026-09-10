import { afterEach, describe, expect, it } from "vitest";

import { resolveClickTarget } from "./resolve-click-target.js";

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe("resolveClickTarget", () => {
  it("returns null for a non-Element target", () => {
    expect(resolveClickTarget(null)).toBeNull();
    expect(resolveClickTarget(document.createTextNode("hi"))).toBeNull();
  });

  it("attributes a click on an inner node to the nearest actionable ancestor", () => {
    const button = mount('<button><span class="i">Go</span></button>');
    const inner = button.querySelector(".i")!;
    const body = resolveClickTarget(inner);
    expect(body).toEqual({ target: { tag: "button", text: "Go" } });
  });

  it("records href, linkKind (via the injected classifier) and newTab for a link", () => {
    const link = mount('<a href="https://x.test" target="_blank">Out</a>');
    const body = resolveClickTarget(link, { classifyHref: () => "external" });
    expect(body).toEqual({
      target: { tag: "a", text: "Out", href: "https://x.test" },
      linkKind: "external",
      newTab: true,
    });
  });

  it("omits linkKind when no classifier is given", () => {
    const link = mount('<a href="/about">About</a>');
    expect(resolveClickTarget(link)).toEqual({
      target: { tag: "a", text: "About", href: "/about" },
    });
  });

  it("carries role and data-analytics-id", () => {
    const el = mount('<div role="button" data-analytics-id="cta-buy">Buy</div>');
    expect(resolveClickTarget(el)).toEqual({
      target: { tag: "div", role: "button", text: "Buy", analyticsId: "cta-buy" },
    });
  });

  it("redacts the label", () => {
    const el = mount("<button>mail me@example.com</button>");
    expect(resolveClickTarget(el)?.target.text).toBe("mail [email]");
  });

  it("still resolves a plain element with no actionable ancestor", () => {
    const el = mount("<p>just text</p>");
    expect(resolveClickTarget(el)).toEqual({ target: { tag: "p", text: "just text" } });
  });
});
