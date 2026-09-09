import { defineActions } from "@feel-your-website/action-core";

/**
 * The registered-actions catalog: every external HTTP endpoint a project's
 * sections (`query`) and CTAs (`mutation`) may reference by id. The id is a
 * closed vocabulary — the concrete URL, headers and secrets live in the
 * invoker's env-driven bindings, never here.
 *
 * These three are examples, the way `sectionCatalog` ships example sections.
 * A real project replaces this list alongside the invoker's bindings; nothing
 * that imports `actionCatalog` needs to change.
 */
export const actionCatalog = defineActions([
  {
    id: "feed.releases",
    kind: "query",
    method: "GET",
    description: "Recent product releases from an external feed.",
    input: [{ name: "limit", label: "How many", type: "number", default: 5 }],
    allowedSources: ["static", "routeParam"],
    cache: { ttlMs: 60_000, swr: true, negativeTtlMs: 10_000 },
  },
  {
    id: "newsletter.subscribe",
    kind: "mutation",
    method: "POST",
    description: "Add an email address to the newsletter list.",
    input: [
      { name: "email", label: "Email", type: "text", required: true },
      { name: "source", label: "Source tag", type: "text" },
    ],
    allowedSources: ["static", "routeParam"],
    idempotent: true,
  },
  {
    id: "webhook.trigger",
    kind: "mutation",
    method: "POST",
    description: "Fire a configured webhook — a rebuild, a notification, an audit ping.",
    input: [{ name: "reason", label: "Reason", type: "text" }],
    allowedSources: ["static", "routeParam"],
    confirm: true,
  },
]);
