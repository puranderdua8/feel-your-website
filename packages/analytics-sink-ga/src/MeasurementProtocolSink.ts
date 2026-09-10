import type { AnalyticsEvent, AnalyticsSink } from "@feel-your-website/analytics-core";

import { toMpPayloads } from "./mp-events.js";

const DEFAULT_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const DEFAULT_TIMEOUT_MS = 3000;

export interface MeasurementProtocolSinkOptions {
  /** GA4 measurement id, e.g. `G-XXXXXXX`. */
  readonly measurementId: string;
  /** Measurement Protocol API secret (GA4 Admin → Data Streams). A server secret. */
  readonly apiSecret: string;
  /**
   * Collect endpoint. Default is production; point at
   * `.../debug/mp/collect` to have GA validate a payload instead of ingesting it.
   */
  readonly endpoint?: string;
  /** Injectable for tests. Defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Per-request timeout in ms. Default 3000. */
  readonly timeoutMs?: number;
}

/**
 * A server-side {@link AnalyticsSink} that relays the first-party collector's
 * batches to GA4 over the Measurement Protocol. Selected by `ANALYTICS_SINK=ga`.
 *
 * It is the ad-block-resilient path: events the browser's `gtag.js` request
 * never made it out for still reach GA from the BFF. The client has already
 * consent-gated and redacted each event (`ingestAnalytics` re-validates the
 * envelope); this sink only maps and forwards.
 *
 * Never throws and never blocks the response: a non-2xx, a network error or a
 * timeout resolves `false` (the batch is dropped), matching
 * `ConsoleAnalyticsSink`'s contract. Analytics loss is acceptable; a 500 on
 * `ingestAnalytics` is not.
 */
export class MeasurementProtocolSink implements AnalyticsSink {
  readonly #url: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: MeasurementProtocolSinkOptions) {
    const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    const query = new URLSearchParams({
      measurement_id: options.measurementId,
      api_secret: options.apiSecret,
    });
    this.#url = `${endpoint}?${query.toString()}`;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async deliver(events: readonly AnalyticsEvent[]): Promise<boolean> {
    const payloads = toMpPayloads(events);
    if (payloads.length === 0) return true;

    const results = await Promise.all(payloads.map((payload) => this.#post(payload)));
    return results.every(Boolean);
  }

  async #post(body: unknown): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetch(this.#url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      // MP returns 204 on success; the debug endpoint returns 200.
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
