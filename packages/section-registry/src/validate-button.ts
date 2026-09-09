import type { FieldIssue, JsonValue } from "@feel-your-website/content-core";

import { classifyHref } from "./link.js";

export interface ButtonIssue extends FieldIssue {
  /** `false` for a non-blocking warning (e.g. an internal link to an unknown route). */
  readonly blocking: boolean;
}

export interface ValidateButtonContext {
  /** Published route patterns, for the internal-link warning. Omit to skip that check. */
  readonly knownRoutePatterns?: readonly string[];
}

function str(fields: Readonly<Record<string, JsonValue>>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

function matchesKnownRoute(pathname: string, patterns: readonly string[]): boolean {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname;
  return patterns.some((pattern) => {
    const source = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:[A-Za-z0-9_]+/g, "[^/]+");
    return new RegExp(`^${source}/?$`).test(path);
  });
}

/**
 * Publish-time checks for a `button` section that `validateSectionFields`
 * cannot express: the href is only required in `link` mode, and it must be a
 * usable link. Returns blocking issues and non-blocking warnings together, so
 * a caller can gate publish on the blocking ones and surface the rest.
 *
 * `mode: "action"` checks are added when that mode is wired.
 */
export function validateButtonSection(
  fields: Readonly<Record<string, JsonValue>>,
  context: ValidateButtonContext = {},
): readonly ButtonIssue[] {
  const issues: ButtonIssue[] = [];
  const mode = str(fields, "mode") || "link";

  if (mode === "link") {
    const raw = str(fields, "href");
    if (raw.trim() === "") {
      issues.push({ field: "href", message: "A link needs a URL.", blocking: true });
    } else {
      const { kind, href } = classifyHref(raw);
      if (kind === "unsafe") {
        issues.push({
          field: "href",
          message: `“${raw}” is not a usable link.`,
          blocking: true,
        });
      } else if (
        kind === "internal" &&
        context.knownRoutePatterns &&
        !matchesKnownRoute(href, context.knownRoutePatterns)
      ) {
        issues.push({
          field: "href",
          message: `No published route matches “${href}”.`,
          blocking: false,
        });
      }
    }
  }

  return issues;
}
