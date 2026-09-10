import { redactText } from "./redact.js";
import type { ClickEvent, ClickTarget, LinkKind } from "./types.js";

/** The click body before the `type` discriminant and envelope are attached. */
export type ClickEventBody = Omit<ClickEvent, "type">;

export interface ResolveClickOptions {
  /**
   * Classifies an `href` (`internal` / `external` / `unsafe`). Injected so this
   * module needs neither the router nor the section registry. Omitted, a link
   * click still records `newTab` but no `linkKind`.
   */
  readonly classifyHref?: (href: string) => LinkKind;
}

/** Nearest ancestor-or-self that is an `Element` — guards text nodes, SVG bits, detached targets. */
function nearestElement(node: EventTarget | null): Element | null {
  let current: Node | null = node instanceof Node ? node : null;
  while (current) {
    if (current instanceof Element) return current;
    current = current.parentNode;
  }
  return null;
}

/**
 * Turns a raw click's `event.target` into a {@link ClickEvent} body, or `null`
 * when there is nothing worth recording (a click on bare document, a non-Element
 * target). Reads only structural attributes and the visible label — never a
 * form value — and the label is run through {@link redactText}.
 */
export function resolveClickTarget(
  rawTarget: EventTarget | null,
  options: ResolveClickOptions = {},
): ClickEventBody | null {
  const element = nearestElement(rawTarget);
  if (!element) return null;

  // Attribute the click to the nearest actionable ancestor, not the exact
  // pixel target (an icon `<svg>` inside a `<button>`, say).
  const actionable = element.closest("a, button, [role], [data-analytics-id]") ?? element;
  const anchor = actionable instanceof HTMLAnchorElement ? actionable : null;
  const href = anchor?.getAttribute("href") ?? undefined;
  const label = redactText(actionable.textContent ?? "");

  const target: ClickTarget = {
    tag: actionable.tagName.toLowerCase(),
    ...(actionable.getAttribute("role") ? { role: actionable.getAttribute("role")! } : {}),
    ...(label ? { text: label } : {}),
    ...(href !== undefined ? { href } : {}),
    ...(actionable.getAttribute("data-analytics-id")
      ? { analyticsId: actionable.getAttribute("data-analytics-id")! }
      : {}),
  };

  if (href === undefined) return { target };

  const linkKind = options.classifyHref?.(href);
  return {
    target,
    ...(linkKind ? { linkKind } : {}),
    ...(anchor?.target === "_blank" ? { newTab: true } : {}),
  };
}
