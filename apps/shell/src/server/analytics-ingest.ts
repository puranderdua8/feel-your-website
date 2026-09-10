import { ANALYTICS_EVENT_TYPES, type AnalyticsEvent } from "@feel-your-website/analytics-core";

/** Most events one POST may carry — a page's whole journey is well under this. */
export const MAX_ANALYTICS_BATCH = 50;
/** Cap on one serialised event — the descriptors we send are small. */
export const MAX_ANALYTICS_EVENT_BYTES = 4 * 1024;

const KNOWN_TYPES = new Set<string>(ANALYTICS_EVENT_TYPES);

const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseEvent(raw: unknown): AnalyticsEvent | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const event = raw as Record<string, unknown>;

  if (!isStr(event.type) || !KNOWN_TYPES.has(event.type)) return null;
  if (!isStr(event.sessionId) || !isNum(event.seq) || !isNum(event.ts) || !isStr(event.path)) {
    return null;
  }
  if (event.type === "section_view" && (!isStr(event.sectionKey) || !isStr(event.instanceId))) {
    return null;
  }
  if (event.type === "click") {
    const target = event.target as Record<string, unknown> | null | undefined;
    if (typeof target !== "object" || target === null || !isStr(target.tag)) return null;
  }
  if (JSON.stringify(raw).length > MAX_ANALYTICS_EVENT_BYTES) return null;

  return raw as AnalyticsEvent;
}

/**
 * Turns an untrusted `{ events: [...] }` POST body into a validated
 * `AnalyticsEvent[]` — closed `type`, well-formed envelope, type-specific
 * fields present, per-event size cap, batch count cap. Anything malformed is
 * dropped; the ingest endpoint never rejects a batch outright.
 */
export function parseAnalyticsBatch(raw: unknown): AnalyticsEvent[] {
  const events = (raw as { events?: unknown } | null | undefined)?.events;
  if (!Array.isArray(events)) return [];

  const out: AnalyticsEvent[] = [];
  for (const item of events.slice(0, MAX_ANALYTICS_BATCH)) {
    const parsed = parseEvent(item);
    if (parsed) out.push(parsed);
  }
  return out;
}
