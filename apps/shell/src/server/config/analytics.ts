/**
 * Reads the shell's analytics configuration from the environment. Every field
 * is safe to send to the browser (a GA measurement id is public), so the whole
 * shape rides on `BootstrapPayload`.
 *
 * Analytics is non-essential: a malformed value here degrades to "off" with a
 * warning, it does not fail the page (unlike `loadActionConfig`).
 */

export type AnalyticsProviderKind = "none" | "ga";

export interface AnalyticsConfig {
  readonly provider: AnalyticsProviderKind;
  /** GA4 measurement id — required when `provider === "ga"`, else `null`. */
  readonly measurementId: string | null;
  /** Path the client POSTs event batches to. Empty string = no first-party collector. */
  readonly collectorPath: string;
  /** Session sampling rate, `0..1`. Defaults to `1` (everyone). */
  readonly sampleRate: number;
}

export const ANALYTICS_OFF: AnalyticsConfig = {
  provider: "none",
  measurementId: null,
  collectorPath: "",
  sampleRate: 1,
};

type Env = Record<string, string | undefined>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Throws on a malformed value — call sites decide whether to degrade or rethrow. */
export function parseAnalyticsConfig(env: Env = process.env): AnalyticsConfig {
  const provider = env.ANALYTICS_PROVIDER ?? "none";
  if (provider !== "none" && provider !== "ga") {
    throw new Error(`Unknown ANALYTICS_PROVIDER "${provider}". Expected "none" or "ga".`);
  }

  let measurementId: string | null = null;
  if (provider === "ga") {
    measurementId = env.ANALYTICS_GA_MEASUREMENT_ID?.trim() || null;
    if (!measurementId) {
      throw new Error('ANALYTICS_GA_MEASUREMENT_ID is required when ANALYTICS_PROVIDER="ga".');
    }
  }

  let sampleRate = 1;
  if (env.ANALYTICS_SAMPLE_RATE !== undefined && env.ANALYTICS_SAMPLE_RATE !== "") {
    const parsed = Number(env.ANALYTICS_SAMPLE_RATE);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `ANALYTICS_SAMPLE_RATE must be a number in [0, 1]; got "${env.ANALYTICS_SAMPLE_RATE}".`,
      );
    }
    sampleRate = clamp01(parsed);
  }

  return {
    provider,
    measurementId,
    collectorPath: env.ANALYTICS_COLLECTOR_PATH?.trim() ?? "",
    sampleRate,
  };
}

/** Parse, but never throw: a bad config logs and becomes {@link ANALYTICS_OFF}. */
export function loadAnalyticsConfig(env: Env = process.env): AnalyticsConfig {
  try {
    return parseAnalyticsConfig(env);
  } catch (error) {
    console.error("[analytics] config invalid, disabling analytics:", error);
    return ANALYTICS_OFF;
  }
}
