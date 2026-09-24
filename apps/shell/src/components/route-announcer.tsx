import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Focus management + announcement for client-side navigation.
 *
 * A full page load resets focus and screen readers announce the new title; a
 * router transition does neither, so keyboard and screen-reader users are left
 * on the link they clicked in a page that has silently changed. After each
 * transition to a new path this moves focus to the new page — the element a
 * `#fragment` names, else the page's `h1`, else its `<main>` — and announces
 * `document.title` in a polite live region (the page's name even when focus
 * lands on a heading-less `<main>`).
 *
 * The initial load (no `fromLocation`) and same-path changes (query or hash
 * only) are left to the browser, so in-page anchors and filters behave as usual.
 */
export function RouteAnnouncer(): React.JSX.Element {
  const router = useRouter();
  const [message, setMessage] = useState("");

  useEffect(
    () =>
      router.subscribe("onRendered", ({ fromLocation, toLocation, pathChanged }) => {
        if (!fromLocation || !pathChanged) return;

        // `onRendered` fires once the new matches have committed; a macrotask
        // later, `<HeadContent>`'s effect has updated `document.title` too.
        // Not `requestAnimationFrame`: it never fires in a hidden tab.
        setTimeout(() => {
          focusPage(toLocation.hash);
          setMessage(document.title);
        });
      }),
    [router],
  );

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

function focusPage(hash: string): void {
  const target =
    (hash ? document.getElementById(hash) : null) ??
    document.querySelector("main h1") ??
    document.querySelector("main");
  if (!(target instanceof HTMLElement)) return;

  // Programmatic focus only; never adds the element to the tab order.
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  // Scroll position is scroll restoration's job (or the fragment's).
  target.focus({ preventScroll: true });
}
