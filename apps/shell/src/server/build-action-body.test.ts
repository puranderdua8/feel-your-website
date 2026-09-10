import type { ActionInputMapping, MutationActionDefinition } from "@feel-your-website/action-core";
import { describe, expect, it } from "vitest";

import { buildActionBody } from "./build-action-body.js";

const def = (
  input: MutationActionDefinition["input"],
  allowedSources: MutationActionDefinition["allowedSources"] = ["static", "routeParam"],
): MutationActionDefinition => ({
  id: "test.mutate",
  kind: "mutation",
  method: "POST",
  description: "test",
  input,
  allowedSources,
});

const email = { name: "email", label: "Email", type: "text" } as const;
const count = { name: "count", label: "Count", type: "number" } as const;
const flag = { name: "flag", label: "Flag", type: "boolean" } as const;

describe("buildActionBody", () => {
  it("fills a static input with the published literal", () => {
    const body = buildActionBody(
      def([email]),
      { email: { source: "static", value: "a@b.c" } },
      {
        routeParams: {},
      },
    );
    expect(body).toEqual({ email: "a@b.c" });
  });

  it("fills a routeParam input from context.routeParams, keyed by the mapped param name", () => {
    const body = buildActionBody(
      def([email]),
      { email: { source: "routeParam", value: "slug" } },
      { routeParams: { slug: "hello" } },
    );
    expect(body).toEqual({ email: "hello" });
  });

  it("is driven by def.input — a mapping key that is not a declared input is ignored", () => {
    const body = buildActionBody(
      def([email]),
      {
        email: { source: "static", value: "a@b.c" },
        secret: { source: "static", value: "leak" },
      } as ActionInputMapping,
      { routeParams: {} },
    );
    expect(body).toEqual({ email: "a@b.c" });
    expect(body).not.toHaveProperty("secret");
  });

  it("omits a routeParam input whose param the route does not have", () => {
    const body = buildActionBody(
      def([email]),
      { email: { source: "routeParam", value: "missing" } },
      { routeParams: { slug: "hello" } },
    );
    expect(body).toEqual({});
  });

  it("does not leak an unmapped route param into the body", () => {
    const body = buildActionBody(def([email]), {}, { routeParams: { slug: "hello", admin: "1" } });
    expect(body).toEqual({});
  });

  it("re-sanitises a routeParam value and drops a hostile one", () => {
    const body = buildActionBody(
      def([email]),
      { email: { source: "routeParam", value: "slug" } },
      { routeParams: { slug: "a/b" } }, // a separator survived — not a clean segment
    );
    expect(body).toEqual({});
  });

  it("treats a static value as a literal — it cannot name a route param", () => {
    const body = buildActionBody(
      def([email]),
      { email: { source: "static", value: "slug" } },
      { routeParams: { slug: "hello" } },
    );
    expect(body).toEqual({ email: "slug" });
  });

  it("drops a mapping whose source the action does not allow", () => {
    const body = buildActionBody(
      def([email], ["static"]), // routeParam not allowed
      { email: { source: "routeParam", value: "slug" } },
      { routeParams: { slug: "hello" } },
    );
    expect(body).toEqual({});
  });

  it("coerces a static value to the input's type, dropping an uncoercible one", () => {
    expect(
      buildActionBody(
        def([count, flag]),
        {
          count: { source: "static", value: "7" },
          flag: { source: "static", value: "true" },
        },
        { routeParams: {} },
      ),
    ).toEqual({ count: 7, flag: true });

    expect(
      buildActionBody(
        def([count]),
        { count: { source: "static", value: "not-a-number" } },
        {
          routeParams: {},
        },
      ),
    ).toEqual({});
  });

  it("reads a formInput value from context.formInput, only for a declared input", () => {
    const body = buildActionBody(
      def([email], ["formInput"]),
      { email: { source: "formInput", value: "email" } },
      { routeParams: {}, formInput: { email: "typed@in.form", other: "ignored" } },
    );
    expect(body).toEqual({ email: "typed@in.form" });
  });

  it("returns {} for an empty mapping", () => {
    expect(buildActionBody(def([email]), {}, { routeParams: { slug: "x" } })).toEqual({});
  });
});
