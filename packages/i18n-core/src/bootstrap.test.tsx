import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BOOTSTRAP_KEYS, BOOTSTRAP_MESSAGES, mergeMessages } from "./bootstrap.js";
import { I18nProvider, useTranslations } from "./react.js";

function Message({ id }: { id: string }) {
  const t = useTranslations();
  return <span>{t(id)}</span>;
}

describe("bootstrap messages", () => {
  it("stays small — product copy belongs in the CMS", () => {
    // A guard against this quietly becoming a second message catalogue.
    expect(BOOTSTRAP_KEYS.length).toBeLessThanOrEqual(20);
  });

  it("has no key that is also a namespace of another", () => {
    // `bootstrap.offline` and `bootstrap.offline.title` cannot coexist: the
    // formatter treats dots as namespaces, so one has to lose, and the leaf
    // silently renders as a raw key. This shipped once — the unflatten tests
    // covered the collision *behaviour* while the message set still triggered
    // it, which is exactly the gap this closes.
    const collisions = BOOTSTRAP_KEYS.filter((key) =>
      BOOTSTRAP_KEYS.some((other) => other.startsWith(`${key}.`)),
    );

    expect(collisions).toEqual([]);
  });

  it("covers the states that render before the CMS can answer", () => {
    for (const key of [
      "bootstrap.loading",
      "bootstrap.offline.body",
      "bootstrap.error.title",
      "bootstrap.retry",
    ]) {
      expect(BOOTSTRAP_MESSAGES[key]).toBeTruthy();
    }
  });

  it("lets CMS messages override any bootstrap string", () => {
    const merged = mergeMessages({ "bootstrap.retry": "Retry now" });
    expect(merged["bootstrap.retry"]).toBe("Retry now");
  });

  it("keeps built-in text for keys the CMS does not define", () => {
    const merged = mergeMessages({ "bootstrap.retry": "Retry now" });
    expect(merged["bootstrap.loading"]).toBe(BOOTSTRAP_MESSAGES["bootstrap.loading"]);
  });

  it("survives the CMS returning nothing at all", () => {
    // The cold-cache outage case: this is the whole reason the set exists.
    expect(mergeMessages(null)).toEqual(BOOTSTRAP_MESSAGES);
    expect(mergeMessages(undefined)).toEqual(BOOTSTRAP_MESSAGES);
  });
});

describe("I18nProvider", () => {
  it("renders bootstrap text when the CMS has not answered", () => {
    render(
      <I18nProvider locale="en">
        <Message id="bootstrap.loading" />
      </I18nProvider>,
    );

    expect(screen.getByText("Loading…")).toBeTruthy();
  });

  it("prefers CMS copy once it arrives", () => {
    render(
      <I18nProvider locale="en" messages={{ "bootstrap.loading": "One moment…" }}>
        <Message id="bootstrap.loading" />
      </I18nProvider>,
    );

    expect(screen.getByText("One moment…")).toBeTruthy();
  });

  it("serves CMS copy in another locale", () => {
    render(
      <I18nProvider locale="hi" messages={{ "page.title": "नमस्ते" }}>
        <Message id="page.title" />
      </I18nProvider>,
    );

    expect(screen.getByText("नमस्ते")).toBeTruthy();
  });

  it("renders the key rather than throwing when a message is missing", () => {
    // A missing key must degrade to something inert. Throwing would take the
    // whole tree down over a copy problem.
    render(
      <I18nProvider locale="en">
        <Message id="totally.unknown.key" />
      </I18nProvider>,
    );

    expect(screen.getByText("totally.unknown.key")).toBeTruthy();
  });

  it("formats ICU arguments from CMS-supplied messages", () => {
    function Plural() {
      const t = useTranslations();
      return <span>{t("clips", { count: 3 })}</span>;
    }

    render(
      <I18nProvider
        locale="en"
        messages={{ clips: "{count, plural, one {# clip} other {# clips}}" }}
      >
        <Plural />
      </I18nProvider>,
    );

    expect(screen.getByText("3 clips")).toBeTruthy();
  });
});
