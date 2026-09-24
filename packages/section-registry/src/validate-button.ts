import {
  isReservedRoutePath,
  type FieldIssue,
  type JsonValue,
} from "@feel-your-website/content-core";

import { classifyHref } from "./link.js";

export interface ButtonIssue extends FieldIssue {
  /** `false` for a non-blocking warning (e.g. an internal link to an unknown route). */
  readonly blocking: boolean;
}

export interface ValidateButtonContext {
  /** Published route patterns, for the internal-link warning. Omit to skip that check. */
  readonly knownRoutePatterns?: readonly string[];
  /**
   * Route patterns in the currently deployed shell build. A route that is
   * published but not yet in a build has no file route, so a client-side link
   * to it lands on the 404 page until the next deploy. Omit when the deployed
   * build is unknown to skip that check.
   */
  readonly deployedRoutePatterns?: readonly string[];
}

function str(fields: Readonly<Record<string, JsonValue>>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function matchesKnownRoute(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => {
    const source = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:[A-Za-z0-9_]+/g, "[^/]+");
    return new RegExp(`^${source}/?$`).test(path);
  });
}

/**
 * Publish-time checks for a `button` section that `validateSectionFields`
 * cannot express: fields are gated by `mode`, and each mode's target must be
 * usable. Returns blocking issues and non-blocking warnings together, so a
 * caller can gate publish on the blocking ones and surface the rest.
 *
 * `mode: "action"` here only checks that an action is named — that the id is a
 * known mutation, and that its body mapping type-checks, needs the action
 * catalog and is done by the CMS (which can import it).
 */
export function validateButtonSection(
  fields: Readonly<Record<string, JsonValue>>,
  context: ValidateButtonContext = {},
): readonly ButtonIssue[] {
  const issues: ButtonIssue[] = [];
  const mode = str(fields, "mode") || "link";

  if (mode === "action") {
    if (str(fields, "actionId").trim() === "") {
      issues.push({ field: "actionId", message: "An action CTA needs an action.", blocking: true });
    }
  } else if (mode === "link") {
    const raw = str(fields, "href");
    if (raw.trim() === "") {
      issues.push({ field: "href", message: "A link needs a URL.", blocking: true });
    } else {
      const { kind, route } = classifyHref(raw);
      if (kind === "unsafe") {
        issues.push({
          field: "href",
          message: `“${raw}” is not a usable link.`,
          blocking: true,
        });
      } else if (route) {
        const issue = internalRouteIssue(route.pathname, context);
        if (issue) issues.push(issue);
      }
    }
  }

  return issues;
}

/**
 * The one issue (if any) with an internal link's path. `/` always exists (the
 * shell's home falls back to its own page) and a reserved prefix belongs to the
 * shell, not the CMS — neither is checked against published routes.
 */
function internalRouteIssue(path: string, context: ValidateButtonContext): ButtonIssue | null {
  if (path.split("/").some((segment) => segment.startsWith(":"))) {
    return {
      field: "href",
      message: `“${path}” is a route pattern — link to a real page, e.g. with the parameter filled in.`,
      blocking: true,
    };
  }
  if (path === "/" || isReservedRoutePath(path)) return null;

  if (context.knownRoutePatterns && !matchesKnownRoute(path, context.knownRoutePatterns)) {
    return { field: "href", message: `No published route matches “${path}”.`, blocking: false };
  }
  if (context.deployedRoutePatterns && !matchesKnownRoute(path, context.deployedRoutePatterns)) {
    return {
      field: "href",
      message: `“${path}” isn't in the deployed site yet — this link shows a 404 until the next deploy.`,
      blocking: false,
    };
  }
  return null;
}
