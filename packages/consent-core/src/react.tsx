"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  isPrivacySignalSet,
  readStoredConsent,
  resolveConsent,
  writeStoredConsent,
  type ConsentChoice,
  type ConsentStatus,
} from "./consent.js";

export interface ConsentContextValue {
  /** The effective status — `denied` whenever a DNT/GPC signal is set. */
  readonly status: ConsentStatus;
  /**
   * `false` until the client has read `localStorage` and the privacy signals
   * on mount. A consent-gated effect should wait for this so it does not act
   * on the SSR seed and then immediately reverse itself.
   */
  readonly ready: boolean;
  /** Record an explicit choice. A `granted` call is ignored while DNT/GPC is set. */
  readonly setConsent: (choice: ConsentChoice) => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export interface ConsentProviderProps {
  children: ReactNode;
  /**
   * SSR seed, from the consent cookie, so the first client render matches the
   * server. The client re-reads storage + privacy signals on mount and
   * corrects if needed.
   */
  initial?: ConsentStatus;
}

export function ConsentProvider({
  children,
  initial = "unknown",
}: ConsentProviderProps): React.JSX.Element {
  const [status, setStatus] = useState<ConsentStatus>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStatus(resolveConsent(readStoredConsent(), isPrivacySignalSet()));
    setReady(true);
  }, []);

  const setConsent = useCallback((choice: ConsentChoice) => {
    // A set privacy signal pins `denied`; a granting click cannot override it.
    if (choice === "granted" && isPrivacySignalSet()) return;
    writeStoredConsent(choice);
    setStatus(choice);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({ status, ready, setConsent }),
    [status, ready, setConsent],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

/**
 * The consent context. Throws outside a `<ConsentProvider>` — a component that
 * gates behaviour on consent must be mounted under one, and a silent default
 * would let un-consented analytics through.
 */
export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within a <ConsentProvider>.");
  return ctx;
}
