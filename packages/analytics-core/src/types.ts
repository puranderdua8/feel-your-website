/**
 * The analytics vocabulary — deliberately a **closed** set of event shapes, not
 * free-form props. A page render, a section scrolling into view, and a click
 * are the whole journey; anything a vendor needs beyond that is derived from
 * these by an adapter, not smuggled in here.
 */

/** Envelope every event carries — session identity, journey order, when, where. */
export interface AnalyticsContext {
  /** Stable per browsing session (30-min sliding window; see `analytics-core`'s `session.ts`). */
  readonly sessionId: string;
  /** Monotonic within the session — the journey order, resilient to out-of-order delivery. */
  readonly seq: number;
  /** Client clock, epoch milliseconds. */
  readonly ts: number;
  /** The normalised pathname the event occurred on. */
  readonly path: string;
}

/** A route was rendered (initial load or a client transition). */
export interface PageViewEvent {
  readonly type: "page";
  readonly title?: string;
  /** `document.referrer` for the first page of a session; omitted after. */
  readonly referrer?: string;
}

/** A section scrolled into view for the first time on this page. */
export interface SectionViewEvent {
  readonly type: "section_view";
  readonly sectionKey: string;
  readonly instanceId: string;
}

/** How a clicked link resolves — mirrors the CTA classifier. */
export type LinkKind = "internal" | "external" | "unsafe";

/** A privacy-safe description of what was clicked — never form values or PII. */
export interface ClickTarget {
  /** Lowercased tag name, e.g. `"a"`, `"button"`. */
  readonly tag: string;
  /** ARIA role, explicit or implicit. */
  readonly role?: string;
  /** Trimmed, length-capped visible label. */
  readonly text?: string;
  /** `href` for an anchor. */
  readonly href?: string;
  /** `data-analytics-id` when the author set one — the stable handle. */
  readonly analyticsId?: string;
}

/** Any click anywhere in the document (one capture-phase listener). */
export interface ClickEvent {
  readonly type: "click";
  readonly target: ClickTarget;
  /** Set when the click was on a link. */
  readonly linkKind?: LinkKind;
  /** Set when the link opens in a new tab. */
  readonly newTab?: boolean;
}

/** The event-specific half, before the envelope is attached. */
export type AnalyticsEventBody = PageViewEvent | SectionViewEvent | ClickEvent;

/** A fully-formed event: its body plus the envelope. */
export type AnalyticsEvent = AnalyticsContext & AnalyticsEventBody;

/** The `type` discriminants, for exhaustive handling and allow-lists. */
export const ANALYTICS_EVENT_TYPES = ["page", "section_view", "click"] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

/* -------------------------------------------------------------------------- *
 * Seams
 * -------------------------------------------------------------------------- */

export interface AnalyticsAdapterConfig {
  /** The current consent state — an adapter must send nothing vendor-side until this is true. */
  readonly consentGranted: boolean;
  /** Log what would be sent instead of / as well as sending it. */
  readonly debug?: boolean;
  /** Vendor-specific settings, e.g. a GA measurement id. */
  readonly options?: Readonly<Record<string, string>>;
}

/**
 * A client-side analytics vendor (GA4, etc.). The provider owns the queue,
 * consent gate, and session lifecycle; an adapter only maps an
 * {@link AnalyticsEvent} to the vendor's API.
 *
 * Every method must be safe to call before {@link init} resolves (buffer) and
 * must never throw — a broken analytics vendor cannot be allowed to break the
 * page.
 */
export interface AnalyticsAdapter {
  /** Load and configure the vendor. Called once. */
  init(config: AnalyticsAdapterConfig): void | Promise<void>;
  /** Attach a user id to the session. Idempotent; merges. */
  identify(userId: string): void;
  /** Record one event. */
  track(event: AnalyticsEvent): void;
}

/**
 * A server-side batch destination for the first-party collector — the BFF's
 * `ingestAnalytics` fn forwards validated batches here (to GA's Measurement
 * Protocol, a log, a warehouse, …). Must never throw.
 */
export interface AnalyticsSink {
  /** Deliver a batch. Resolves `true` when accepted, `false` when dropped. */
  deliver(events: readonly AnalyticsEvent[]): Promise<boolean>;
}
