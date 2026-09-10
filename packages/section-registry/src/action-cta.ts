import type { JsonValue } from "@feel-your-website/content-core";
import type { ReactNode } from "react";

/**
 * What a `mode: "action"` button hands its host-injected renderer.
 *
 * The shared registry never imports the action catalog or the router, so
 * anything the interactive CTA needs that lives outside the content tree — the
 * action's `confirm` / `idempotent` flags, the server endpoint — the host
 * looks up itself from `instanceId` + `actionId`. The shell supplies a client
 * form that POSTs to a server fn; the CMS supplies nothing (the preview shows
 * the disabled placeholder).
 */
export interface ActionCtaSpec {
  /** The section instance, so the server can re-resolve the route and authorise the call. */
  readonly instanceId: string;
  /** The registered action id the CTA fires. Verified against the catalog server-side. */
  readonly actionId: string;
  readonly label: string;
  /** Shown after a successful call; the host falls back to `label`. */
  readonly successLabel?: string;
  /**
   * The authored request-body mapping, verbatim from the `actionBody` field.
   * A hint for the form only — the server re-derives the authoritative body
   * from published content and never trusts this.
   */
  readonly body: JsonValue;
  /**
   * The enclosing `form` section's current input values, keyed by field name —
   * present only when the button is inside a `form`. The host form component
   * forwards these as `formInput` on submit; the server still validates them
   * against the action's declared inputs.
   */
  readonly formInput?: Readonly<Record<string, JsonValue>>;
  /** The CTA class the link renderer also uses, so both modes look identical. */
  readonly className: string;
}

/** Host-injected renderer for an action-mode CTA. */
export type RenderActionCta = (spec: ActionCtaSpec) => ReactNode;
