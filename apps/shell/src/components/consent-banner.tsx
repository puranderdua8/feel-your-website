import { useConsent } from "@feel-your-website/consent-core/react";

/**
 * The analytics-consent prompt. Shows only while the choice is `unknown` and
 * the client has read its stored value — a returning visitor, or one whose
 * browser sends DNT/GPC (forced `denied`), never sees it. Choosing either
 * option persists it (see `consent-core`) so the next SSR render already knows.
 */
export function ConsentBanner(): React.JSX.Element | null {
  const { status, ready, setConsent } = useConsent();

  if (!ready || status !== "unknown") return null;

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="border-border bg-background fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          We use analytics to understand how the site is used. Nothing is sent until you choose.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="border-border rounded-[var(--radius)] border px-3 py-1.5 text-sm font-medium"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="bg-primary text-primary-foreground rounded-[var(--radius)] px-3 py-1.5 text-sm font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
