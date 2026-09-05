import type { RouteSectionNode } from "@feel-your-website/content-core";
import { Button } from "@feel-your-website/ui";
import { useCallback, useEffect, useState } from "react";

import { checkRoutePublishReadiness, type PublishReadiness } from "@/server/bff";

/**
 * Save draft / publish, with a per-locale completeness gate plus the
 * structural outlet/children check. `Publish` is disabled while any
 * configured locale is missing content for a section the route depends on, or
 * a blocking structural issue stands — unless the author explicitly forces it.
 */
export function PublishBar({
  tree,
  hasChildren,
  pending,
  onSaveDraft,
  onPublish,
}: {
  tree: readonly RouteSectionNode[];
  /** Whether another route already names this one as its parent. */
  hasChildren: boolean;
  pending: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  const [readiness, setReadiness] = useState<PublishReadiness | null>(null);
  const [checking, setChecking] = useState(false);
  const [force, setForce] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setReadiness(await checkRoutePublishReadiness({ data: { tree, hasChildren } }));
    } finally {
      setChecking(false);
    }
  }, [tree, hasChildren]);

  // Runs automatically whenever the tree or the children set changes, not
  // only when the author happens to press "Check readiness" — leaving that
  // button unclicked was exactly how a layout with children and no outlet
  // used to reach Publish with the button never disabled. Debounced so a
  // burst of content-field keystrokes collapses into one round trip; the
  // server still enforces the blocking rules independently on save.
  useEffect(() => {
    setForce(false);
    const timer = setTimeout(() => void check(), 400);
    return () => clearTimeout(timer);
  }, [check]);

  const blocked = readiness !== null && !readiness.ready && !force;

  return (
    <div className="border-border flex flex-col gap-3 rounded-[var(--radius)] border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={onSaveDraft}>
          Save draft
        </Button>
        <Button type="button" variant="outline" disabled={checking} onClick={() => void check()}>
          {checking ? "Checking…" : "Check readiness"}
        </Button>
        <Button type="button" disabled={pending || blocked} onClick={onPublish}>
          Publish
        </Button>
        {readiness !== null && (
          <span
            className={readiness.ready ? "text-sm text-emerald-600" : "text-destructive text-sm"}
          >
            {readiness.ready
              ? "Ready to publish."
              : `${readiness.gaps.length} translation gap(s), ${readiness.structuralIssues.length} structural issue(s).`}
          </span>
        )}
      </div>

      {readiness !== null && readiness.structuralIssues.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs">
          {readiness.structuralIssues.map((issue, index) => (
            <li
              key={index}
              className={issue.blocking ? "text-destructive" : "text-muted-foreground"}
            >
              {issue.blocking ? "⛔" : "⚠️"} {issue.message}
            </li>
          ))}
        </ul>
      )}

      {readiness !== null && readiness.gaps.length > 0 && (
        <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          {readiness.gaps.map((gap, index) => (
            <li key={index}>
              <code>{gap.locale}</code> · <code>{gap.sectionKey}</code>{" "}
              <span className="opacity-60">({gap.instanceId.slice(0, 8)})</span> —{" "}
              {gap.missing.includes("*") ? "no content" : `missing: ${gap.missing.join(", ")}`}
            </li>
          ))}
        </ul>
      )}

      {readiness !== null && !readiness.ready && (
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Publish anyway
        </label>
      )}
    </div>
  );
}
