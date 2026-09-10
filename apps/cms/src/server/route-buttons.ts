import { parseActionInputMapping, validateActionBinding } from "@feel-your-website/action-core";
import { actionCatalog } from "@feel-your-website/action-registry";
import type { JsonValue, RouteSectionNode } from "@feel-your-website/content-core";
import { flattenNodes } from "@feel-your-website/content-core";
import { classifyHref, validateButtonSection } from "@feel-your-website/section-registry";

export interface RouteButtonIssue {
  readonly instanceId: string;
  readonly message: string;
  /** `false` for a warning surfaced but not enforced. */
  readonly blocking: boolean;
}

export interface CollectRouteButtonOptions {
  /** Published route patterns, for the internal-link warning. */
  readonly knownRoutePatterns?: readonly string[];
  /** Param names this route exposes, for a `routeParam` mapping on an action CTA. */
  readonly routeParamNames?: readonly string[];
}

/**
 * Catalog-aware checks for a `mode: "action"` button — the ones
 * `validateButtonSection` (which never sees the action catalog) leaves to the
 * CMS: the id must name a registered mutation, and the body mapping must parse
 * and bind cleanly to that action's inputs. All blocking.
 */
function actionButtonIssues(
  fields: Readonly<Record<string, JsonValue>>,
  routeParamNames: readonly string[],
): { message: string; blocking: boolean }[] {
  const actionId = typeof fields.actionId === "string" ? fields.actionId.trim() : "";
  if (actionId === "") return []; // "needs an action" is validateButtonSection's job

  const def = actionCatalog.byId.get(actionId);
  if (!def) return [{ message: `"${actionId}" is not a registered action.`, blocking: true }];
  if (def.kind !== "mutation") {
    return [
      { message: `"${actionId}" is a data action and can't be fired by a CTA.`, blocking: true },
    ];
  }

  const mapping = parseActionInputMapping(fields.body ?? "");
  if (!mapping) return [{ message: "The request body is not valid.", blocking: true }];

  return validateActionBinding(def, mapping, { routeParamNames: [...routeParamNames] }).map(
    (issue) => ({ message: `Request body — ${issue.message}`, blocking: true }),
  );
}

/**
 * Every publish-readiness issue across a route tree's `button` nodes:
 * conditional-required, href-safety and — for a `mode: "action"` button —
 * catalog-binding checks that `validateSectionFields` cannot express, run per
 * locale and de-duplicated per node.
 */
export function collectRouteButtonIssues(
  tree: readonly RouteSectionNode[],
  options: CollectRouteButtonOptions = {},
): readonly RouteButtonIssue[] {
  const out: RouteButtonIssue[] = [];
  const routeParamNames = options.routeParamNames ?? [];

  for (const node of flattenNodes(tree)) {
    if (node.sectionKey !== "button") continue;

    const seen = new Set<string>();
    const push = (message: string, blocking: boolean): void => {
      if (seen.has(message)) return;
      seen.add(message);
      out.push({ instanceId: node.instanceId, message, blocking });
    };

    for (const fields of Object.values(node.content)) {
      for (const issue of validateButtonSection(fields, options)) {
        push(issue.message, issue.blocking);
      }
      if (fields.mode === "action") {
        for (const issue of actionButtonIssues(fields, routeParamNames)) {
          push(issue.message, issue.blocking);
        }
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
