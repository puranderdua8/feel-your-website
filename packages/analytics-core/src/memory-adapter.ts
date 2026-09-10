import type { AnalyticsAdapter, AnalyticsAdapterConfig, AnalyticsEvent } from "./types.js";

export interface MemoryAnalyticsAdapterOptions {
  /**
   * Throw from the Nth `track()` call (1-based) — a fault injector for testing
   * that a *consumer* swallows a broken vendor. A real adapter must never
   * throw, so the contract suite never sets this.
   */
  readonly throwOnTrack?: number;
}

/**
 * An {@link AnalyticsAdapter} that records everything for assertions. Events
 * tracked before {@link init} are buffered and flushed once it runs — the same
 * contract a real vendor SDK must honour while its script loads.
 */
export class MemoryAnalyticsAdapter implements AnalyticsAdapter {
  /** Every event delivered so far, in order. */
  readonly tracked: AnalyticsEvent[] = [];

  #config: AnalyticsAdapterConfig | null = null;
  #userId: string | null = null;
  #buffer: AnalyticsEvent[] = [];
  #trackCalls = 0;
  readonly #throwOnTrack: number | undefined;

  constructor(options: MemoryAnalyticsAdapterOptions = {}) {
    this.#throwOnTrack = options.throwOnTrack;
  }

  /** The config from the most recent `init`, or `null` before one. */
  get config(): AnalyticsAdapterConfig | null {
    return this.#config;
  }

  /** The id from the most recent `identify`, or `null`. */
  get userId(): string | null {
    return this.#userId;
  }

  init(config: AnalyticsAdapterConfig): void {
    this.#config = config;
    if (this.#buffer.length > 0) {
      this.tracked.push(...this.#buffer);
      this.#buffer = [];
    }
  }

  identify(userId: string): void {
    this.#userId = userId;
  }

  track(event: AnalyticsEvent): void {
    this.#trackCalls += 1;
    if (this.#throwOnTrack === this.#trackCalls) {
      throw new Error("MemoryAnalyticsAdapter: simulated vendor failure");
    }
    if (this.#config === null) {
      this.#buffer.push(event);
      return;
    }
    this.tracked.push(event);
  }

  /** Test helper: back to a pristine adapter. */
  reset(): void {
    this.tracked.length = 0;
    this.#buffer = [];
    this.#config = null;
    this.#userId = null;
    this.#trackCalls = 0;
  }
}
