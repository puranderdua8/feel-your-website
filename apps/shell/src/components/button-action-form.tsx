import { actionCatalog } from "@feel-your-website/action-registry";
import type { ActionCtaSpec, RenderActionCta } from "@feel-your-website/section-registry";
import { useRouter } from "@tanstack/react-router";
import { useId, useRef, useState } from "react";

import { invokeAction } from "@/server/bff";

/**
 * The shell's `mode: "action"` CTA — injected into `renderComposition` as
 * `renderActionCta`. A button that fires a registered mutation through the
 * `invokeAction` server fn and reports the outcome.
 *
 * It never sends the action id, the body, or a tree — only the pathname, the
 * node's `instanceId`, and a fresh `requestId` per submit. The server
 * re-derives everything else from published content (see `resolveAndInvokeAction`).
 */

type Status =
  | { readonly kind: "idle" }
  | { readonly kind: "submitting" }
  | { readonly kind: "success"; readonly message: string }
  | {
      readonly kind: "error";
      readonly message: string;
      readonly issues: readonly { readonly field: string; readonly message: string }[];
    };

const GENERIC_ERROR = "The service is unavailable right now — try again.";

/** A user-facing line per normalised failure code — upstream text is never shown. */
const CODE_MESSAGES: Record<string, string> = {
  forbidden: "You do not have permission to do that.",
  not_found: "This action is not available.",
  invalid_request: "Some of the details are not valid.",
  invalid_response: "The service returned an unexpected response.",
  rate_limited: "Too many attempts — try again in a moment.",
  timeout: "The request timed out — try again.",
  unavailable: GENERIC_ERROR,
};

function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ButtonActionForm({ spec }: { spec: ActionCtaSpec }): React.JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const regionRef = useRef<HTMLParagraphElement>(null);
  const regionId = useId();

  const def = actionCatalog.byId.get(spec.actionId);
  const confirmPrompt =
    def && def.kind === "mutation" && def.confirm ? `${spec.label} — are you sure?` : null;

  const busy = status.kind === "submitting";
  const done = status.kind === "success";
  const disabled = busy || done;

  async function onClick(): Promise<void> {
    if (disabled) return;
    if (confirmPrompt && !window.confirm(confirmPrompt)) return;

    setStatus({ kind: "submitting" });
    try {
      const result = await invokeAction({
        data: {
          path: router.state.location.pathname,
          instanceId: spec.instanceId,
          requestId: newRequestId(),
          // The values the visitor typed into the enclosing `form`, if any.
          // The server rebuilds the body from `def.input` and re-validates —
          // this only supplies the `formInput`-sourced values it can't derive.
          ...(spec.formInput ? { formInput: spec.formInput } : {}),
        },
      });

      if (result.ok) {
        setStatus({ kind: "success", message: spec.successLabel ?? "Done." });
      } else {
        setStatus({
          kind: "error",
          message: CODE_MESSAGES[result.code] ?? "Something went wrong.",
          issues: result.issues ?? [],
        });
      }
    } catch {
      setStatus({ kind: "error", message: GENERIC_ERROR, issues: [] });
    } finally {
      // Pull focus to the result so a screen reader announces the outcome even
      // if the polite live region is missed.
      queueMicrotask(() => regionRef.current?.focus());
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={disabled ? `${spec.className} cursor-not-allowed opacity-50` : spec.className}
        onClick={() => void onClick()}
        disabled={disabled}
        aria-busy={busy}
        aria-describedby={status.kind === "idle" ? undefined : regionId}
      >
        {done ? (spec.successLabel ?? spec.label) : spec.label}
      </button>

      <p
        id={regionId}
        ref={regionRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="text-sm outline-none"
      >
        {status.kind === "submitting" && <span className="text-muted-foreground">Working…</span>}
        {status.kind === "success" && status.message}
        {status.kind === "error" && (
          <>
            <span className="text-destructive">{status.message}</span>
            {status.issues.length > 0 && (
              <span className="text-muted-foreground mt-0.5 block">
                {status.issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ")}
              </span>
            )}
          </>
        )}
      </p>
    </span>
  );
}

export const renderActionCta: RenderActionCta = (spec) => <ButtonActionForm spec={spec} />;
