import type {
  AnalyticsAdapter,
  AnalyticsAdapterConfig,
  AnalyticsEvent,
} from "@feel-your-website/analytics-core";

/** The `gtag()` command function, as narrow as we use it. */
export type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

const GA_SRC = "https://www.googletagmanager.com/gtag/js";

/** Consent Mode v2 — everything denied until the visitor opts in. */
const CONSENT_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
} as const;

const CONSENT_GRANTED = {
  ...CONSENT_DENIED,
  analytics_storage: "granted",
} as const;

export interface GaAnalyticsAdapterOptions {
  /** GA4 measurement id, e.g. `G-XXXXXXX`. */
  readonly measurementId: string;
  /**
   * Appends the `gtag.js` `<script>`. Overridable for tests / a CSP-nonce
   * setup. Default: one `async` script tag on `<head>`, added at most once.
   */
  readonly loadScript?: (measurementId: string) => void;
  /** The `gtag` function. Default: the real `window.gtag` shim the adapter installs. */
  readonly gtag?: Gtag;
}

/**
 * Google Analytics 4 adapter. Installs the standard `gtag` shim, sets Consent
 * Mode v2 to **denied** before anything loads, flips `analytics_storage` to
 * `granted` only when consent is given, and maps each {@link AnalyticsEvent} to
 * a GA4 event. Its own automatic `page_view` is turned off — the pageview
 * tracker sends ours.
 *
 * Every method is a no-op on the server and never throws.
 */
export class GaAnalyticsAdapter implements AnalyticsAdapter {
  readonly #measurementId: string;
  readonly #loadScript: (measurementId: string) => void;
  #gtag: Gtag | null;
  #started = false;
  #consentGranted = false;
  #buffer: AnalyticsEvent[] = [];

  constructor(options: GaAnalyticsAdapterOptions) {
    this.#measurementId = options.measurementId;
    this.#gtag = options.gtag ?? null;
    this.#loadScript = options.loadScript ?? defaultLoadScript;
  }

  init(config: AnalyticsAdapterConfig): void {
    if (typeof window === "undefined") return;

    if (!this.#started) {
      this.#started = true;

      window.dataLayer ??= [];
      if (!this.#gtag) {
        const gtag: Gtag = (...args) => {
          window.dataLayer!.push(args);
        };
        window.gtag = gtag;
        this.#gtag = gtag;
      }

      // Consent Mode BEFORE the library loads.
      this.#call("consent", "default", { ...CONSENT_DENIED, wait_for_update: 500 });
      this.#call("js", new Date());
      this.#call("config", this.#measurementId, { send_page_view: false });
      this.#loadScript(this.#measurementId);

      for (const event of this.#buffer) this.#forward(event);
      this.#buffer = [];
    }

    this.#setConsent(config.consentGranted);
  }

  identify(userId: string): void {
    this.#call("set", { user_id: userId });
  }

  track(event: AnalyticsEvent): void {
    if (!this.#gtag) {
      this.#buffer.push(event);
      return;
    }
    this.#forward(event);
  }

  #setConsent(granted: boolean): void {
    if (granted === this.#consentGranted && this.#started) return;
    this.#consentGranted = granted;
    this.#call("consent", "update", granted ? CONSENT_GRANTED : CONSENT_DENIED);
  }

  #forward(event: AnalyticsEvent): void {
    const common = {
      page_path: event.path,
      fyw_session_id: event.sessionId,
      fyw_seq: event.seq,
    };
    switch (event.type) {
      case "page":
        this.#call("event", "page_view", {
          ...common,
          ...(event.referrer ? { page_referrer: event.referrer } : {}),
          ...(event.title ? { page_title: event.title } : {}),
        });
        break;
      case "section_view":
        this.#call("event", "section_view", {
          ...common,
          section_key: event.sectionKey,
          section_instance: event.instanceId,
        });
        break;
      case "click":
        this.#call("event", "click", {
          ...common,
          target_tag: event.target.tag,
          ...(event.target.text ? { target_text: event.target.text } : {}),
          ...(event.target.href ? { link_url: event.target.href } : {}),
          ...(event.target.analyticsId ? { target_id: event.target.analyticsId } : {}),
          ...(event.linkKind ? { link_kind: event.linkKind } : {}),
          ...(event.newTab ? { new_tab: true } : {}),
        });
        break;
    }
  }

  #call(...args: unknown[]): void {
    try {
      this.#gtag?.(...args);
    } catch {
      // A broken tag must never break the page.
    }
  }
}

function defaultLoadScript(measurementId: string): void {
  const src = `${GA_SRC}?id=${encodeURIComponent(measurementId)}`;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}
