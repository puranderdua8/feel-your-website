import type { RouteSectionNode } from "@feel-your-website/content-core";
import { flattenNodes } from "@feel-your-website/content-core";
import { classifyHref, validateButtonSection } from "@feel-your-website/section-registry";

export interface RouteButtonIssue {
  readonly instanceId: string;
  readonly message: string;
  /** `false` for a warning surfaced but not enforced. */
  readonly blocking: boolean;
}

/**
 * Every publish-readiness issue across a route tree's `button` nodes:
 * conditional-required and href-safety checks that `validateSectionFields`
 * cannot express, run per locale and de-duplicated per node.
 */
export function collectRouteButtonIssues(
  tree: readonly RouteSectionNode[],
  options: { readonly knownRoutePatterns?: readonly string[] } = {},
): readonly RouteButtonIssue[] {
  const out: RouteButtonIssue[] = [];

  for (const node of flattenNodes(tree)) {
    if (node.sectionKey !== "button") continue;

    const seen = new Set<string>();
    for (const fields of Object.values(node.content)) {
      for (const issue of validateButtonSection(fields, options)) {
        if (seen.has(issue.message)) continue;
        seen.add(issue.message);
        out.push({ instanceId: node.instanceId, message: issue.message, blocking: issue.blocking });
      }
    }
  }

  return out;
}

/**
 * The first `button` in the tree whose authored href would render as an
 * `unsafe` link (`javascript:` / `data:` / protocol-relative / …), or `null`.
 * This must block any save — draft or not — the way an unknown section key
 * does; it is never a work-in-progress state.
 */
export function firstUnsafeButtonHref(tree: readonly RouteSectionNode[]): string | null {
  for (const node of flattenNodes(tree)) {
    if (node.sectionKey !== "button") continue;
    for (const fields of Object.values(node.content)) {
      const raw = typeof fields.href === "string" ? fields.href : "";
      const mode = typeof fields.mode === "string" ? fields.mode : "link";
      if (mode === "link" && raw.trim() !== "" && classifyHref(raw).kind === "unsafe") {
        return raw;
      }
    }
  }
  return null;
}
