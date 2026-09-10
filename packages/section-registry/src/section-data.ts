import type { JsonValue } from "@feel-your-website/content-core";
import { arrayOf, field, isString, parse } from "@feel-your-website/json-guards";

import type { RouteRenderContext } from "./context.js";

/**
 * A resolved query-action call: the action id plus the request body already
 * built from this section's authored fields and route params. Query inputs
 * are `static` / `routeParam` only, so a section's own `deriveInvocation`
 * code can produce the body directly — no author-configured mapping and no
 * server-side re-derivation are needed (unlike a mutation CTA).
 */
export interface QueryInvocation {
  readonly actionId: string;
  readonly body: Readonly<Record<string, JsonValue>>;
}

/**
 * How a section type declares its external-data need. Pure and SSR-safe: it
 * describes the call and shapes the result, but never performs the call.
 */
export interface SectionQuerySpec<TParsed = unknown> {
  /**
   * Build the query invocation from this instance's authored fields and the
   * route it renders on. Return `null` when the instance needs no data (e.g.
   * an unfilled source field).
   */
  deriveInvocation(
    fields: Readonly<Record<string, JsonValue>>,
    route: RouteRenderContext | undefined,
  ): QueryInvocation | null;
  /**
   * Narrow the (already structurally-parsed) result to exactly what the
   * component renders. `null` rejects the payload. Runs per instance.
   */
  project?(result: JsonValue): TParsed | null;
  /** Stand-in data for the CMS preview, which makes no real call. */
  previewSample?: JsonValue;
  /**
   * `false` → this section is left out of the SSR wait; it renders a skeleton
   * and fetches on the client. Default `true`.
   */
  blocking?: boolean;
}

/* -------------------------------------------------------------------------- *
 * `release-feed` — the one worked example.
 *
 * Parallels the example components in `registry.tsx`: a real project swaps
 * this spec (and its section) for its own. It references the `feed.releases`
 * registered query by id only — never an imported catalog, so this module
 * keeps its single dependency (`json-guards`) and stays SSR-pure.
 * -------------------------------------------------------------------------- */

/** One entry a `release-feed` section renders, after `project` has narrowed it. */
export interface Release {
  readonly title: string;
  readonly url: string;
  readonly date: string;
}

const isRelease = (value: unknown): value is Release =>
  field(value, "title", isString) !== null &&
  field(value, "url", isString) !== null &&
  field(value, "date", isString) !== null;

/**
 * Narrows an untrusted `feed.releases` payload to `Release[]`, or `null`. The
 * feed is expected to return a bare JSON array; anything else is rejected and
 * the section renders its fallback.
 */
export function parseReleases(raw: JsonValue): Release[] | null {
  return parse(raw, arrayOf(isRelease));
}

const RELEASE_COUNT_MIN = 1;
const RELEASE_COUNT_MAX = 20;
const RELEASE_COUNT_DEFAULT = 5;

const releaseFeedQuery: SectionQuerySpec<Release[]> = {
  deriveInvocation: (fields) => {
    const raw = fields.count;
    const count =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.min(RELEASE_COUNT_MAX, Math.max(RELEASE_COUNT_MIN, Math.trunc(raw)))
        : RELEASE_COUNT_DEFAULT;
    return { actionId: "feed.releases", body: { limit: count } };
  },
  project: parseReleases,
  previewSample: [
    {
      title: "v2.4.0 — faster cold starts",
      url: "https://example.com/releases/v2.4.0",
      date: "2026-02-18",
    },
    {
      title: "v2.3.0 — dark mode everywhere",
      url: "https://example.com/releases/v2.3.0",
      date: "2026-01-27",
    },
    {
      title: "v2.2.1 — bug fixes",
      url: "https://example.com/releases/v2.2.1",
      date: "2026-01-09",
    },
  ],
};

/**
 * `sectionKey` → its query spec. One entry today (`release-feed`, the worked
 * example); a real project registers its data sections here alongside their
 * components in `registry.tsx`.
 */
export const SECTION_QUERY_REGISTRY: Readonly<Record<string, SectionQuerySpec>> = {
  "release-feed": releaseFeedQuery,
};
