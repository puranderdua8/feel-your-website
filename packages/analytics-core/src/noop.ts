import type { AnalyticsAdapter, AnalyticsEvent, AnalyticsSink } from "./types.js";

/**
 * The zero-config adapter: accepts everything, sends nothing. This is what a
 * shell with no `ANALYTICS_PROVIDER` set uses, so the provider tree can be
 * mounted unconditionally with no network traffic.
 */
export class NoopAnalyticsAdapter implements AnalyticsAdapter {
  init(): void {}
  identify(): void {}
  track(): void {}
}

/**
 * The default sink: logs each batch instead of forwarding it. Useful in local
 * dev and as the `ANALYTICS_SINK=console` option.
 */
export class ConsoleAnalyticsSink implements AnalyticsSink {
  readonly #label: string;

  constructor(label = "[analytics]") {
    this.#label = label;
  }

  deliver(events: readonly AnalyticsEvent[]): Promise<boolean> {
    for (const event of events) {
      console.info(this.#label, event.type, {
        sessionId: event.sessionId,
        seq: event.seq,
        path: event.path,
      });
    }
    return Promise.resolve(true);
  }
}
