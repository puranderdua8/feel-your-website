import { useEffect, useRef, type ReactNode } from "react";

/** What a section reports the first time it scrolls into view. */
export interface SectionInView {
  readonly instanceId: string;
  readonly sectionKey: string;
}

export type OnSectionInView = (section: SectionInView) => void;

interface Registration {
  readonly instanceId: string;
  readonly sectionKey: string;
  readonly onInView: OnSectionInView;
}

/** How much of a section must be visible before it counts as "viewed". */
const VISIBLE_RATIO = 0.25;

// One IntersectionObserver for every SectionBoundary on the page — N sections
// cost one observer, not N.
let sharedObserver: IntersectionObserver | null = null;
const registrations = new Map<Element, Registration>();

function observerCallback(records: IntersectionObserverEntry[]): void {
  for (const record of records) {
    if (!record.isIntersecting) continue;
    const registration = registrations.get(record.target);
    if (!registration) continue;
    // Fire once: stop watching this element the moment it's seen.
    registrations.delete(record.target);
    sharedObserver?.unobserve(record.target);
    registration.onInView({
      instanceId: registration.instanceId,
      sectionKey: registration.sectionKey,
    });
  }
}

function getSharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  sharedObserver ??= new IntersectionObserver(observerCallback, { threshold: VISIBLE_RATIO });
  return sharedObserver;
}

/** Test seam: drop the shared observer and every pending registration. */
export function resetSectionObserver(): void {
  sharedObserver?.disconnect();
  sharedObserver = null;
  registrations.clear();
}

export interface SectionBoundaryProps {
  readonly instanceId: string;
  readonly sectionKey: string;
  /** Called once, the first time the section is at least 25% visible. */
  readonly onInView?: OnSectionInView;
  readonly children: ReactNode;
}

/**
 * Wraps a composed section so it can report the first time it enters the
 * viewport. SSR-transparent: on the server it is just a `<div>` carrying
 * `data-section-instance` / `data-section-key`; the observation is a
 * client-only `useEffect`. When no `IntersectionObserver` exists (an old
 * browser), the section is reported as viewed on mount.
 */
export function SectionBoundary({
  instanceId,
  sectionKey,
  onInView,
  children,
}: SectionBoundaryProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !onInView) return;

    const observer = getSharedObserver();
    if (!observer) {
      onInView({ instanceId, sectionKey });
      return;
    }

    registrations.set(element, { instanceId, sectionKey, onInView });
    observer.observe(element);
    return () => {
      registrations.delete(element);
      observer.unobserve(element);
    };
  }, [instanceId, sectionKey, onInView]);

  return (
    <div ref={ref} data-section-instance={instanceId} data-section-key={sectionKey}>
      {children}
    </div>
  );
}
