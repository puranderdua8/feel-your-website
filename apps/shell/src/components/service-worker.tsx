import { useTranslations } from "@feel-your-website/i18n-core/react";
import { Button } from "@feel-your-website/ui";
import { useCallback, useEffect, useState } from "react";

/**
 * Registers the service worker and surfaces the two states a user can act on:
 * "you are offline" and "a new version is ready".
 *
 * Registration uses the plain `navigator.serviceWorker` API rather than
 * vite-plugin-pwa's `virtual:pwa-register` module. The virtual module has to
 * resolve in every Vite build environment, and TanStack Start runs two — so
 * importing it here broke the server build, while restricting the plugin to
 * the client build broke resolution. The browser API has no such problem, is
 * about thirty lines, and leaves the choice of service-worker generator free.
 *
 * Updates are offered rather than applied. Swapping the running app out from
 * under someone mid-task can lose whatever they were doing; the timing
 * belongs to the user.
 */
export function ServiceWorkerNotice() {
  const t = useTranslations();
  const [offline, setOffline] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;

        // A worker already parked and waiting means an update is ready now.
        if (registration.waiting) setWaiting(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            // `controller` is null on the very first install — that is not an
            // update, it is the worker taking over for the first time, and
            // prompting for it would be noise.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch((error: unknown) => {
        // Never let a failed registration break the page: the app works
        // without a service worker, just without offline reads.
        console.error("[pwa] service worker registration failed:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    // The new worker is waiting for the old one to be released. Tell it to
    // take over, then reload once it has.
    waiting.postMessage({ type: "SKIP_WAITING" });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), {
      once: true,
    });
  }, [waiting]);

  if (!offline && !waiting) return null;

  return (
    <div
      // `polite` rather than `assertive`: neither message is urgent enough to
      // interrupt what a screen reader is currently saying.
      role="status"
      aria-live="polite"
      className="border-border bg-background flex items-center justify-between gap-4 border-b px-4 py-2 text-sm"
    >
      {offline ? (
        <span>{t("bootstrap.offline.body")}</span>
      ) : (
        <>
          <span>{t("bootstrap.update.body")}</span>
          <Button size="sm" onClick={applyUpdate}>
            {t("bootstrap.update.action")}
          </Button>
        </>
      )}
    </div>
  );
}
