import type { AnalyticsEvent } from "@feel-your-website/analytics-core";

/** One entry in a Measurement Protocol request's `events` array. */
export interface MpEvent {
  readonly name: string;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

/** The JSON body of a single `POST /mp/collect` call. */
export interface MpPayload {
  /** Stable per browsing session — GA4 needs one `client_id` per request. */
  readonly client_id: string;
  /** Epoch microseconds of the batch; GA4 rejects anything older than 72h. */
  readonly timestamp_micros?: number;
  readonly events: readonly MpEvent[];
}

/**
 * Maps our closed {@link AnalyticsEvent} union to a GA4 event, mirroring
 * `GaAnalyticsAdapter`'s client-side `#forward` so the first-party relay and
 * the vendor tag report the same event names and params.
 *
 * `engagement_time_msec` + `session_id` are what GA4 needs to attribute a
 * relayed event to a session and count it in reports; the `fyw_*` params carry
 * our own journey identity for debugging and custom dimensions.
 */
export function toMpEvent(event: AnalyticsEvent): MpEvent {
  const common = {
    engagement_time_msec: 1,
    session_id: event.sessionId,
    page_path: event.path,
    fyw_session_id: event.sessionId,
    fyw_seq: event.seq,
  };

  switch (event.type) {
    case "page":
      return {
        name: "page_view",
        params: {
          ...common,
          ...(event.referrer ? { page_referrer: event.referrer } : {}),
          ...(event.title ? { page_title: event.title } : {}),
        },
      };
    case "section_view":
      return {
        name: "section_view",
        params: {
          ...common,
          section_key: event.sectionKey,
          section_instance: event.instanceId,
        },
      };
    case "click":
      return {
        name: "click",
        params: {
          ...common,
          target_tag: event.target.tag,
          ...(event.target.text ? { target_text: event.target.text } : {}),
          ...(event.target.href ? { link_url: event.target.href } : {}),
          ...(event.target.analyticsId ? { target_id: event.target.analyticsId } : {}),
          ...(event.linkKind ? { link_kind: event.linkKind } : {}),
          ...(event.newTab ? { new_tab: true } : {}),
        },
      };
  }
}

/** GA4 accepts at most 25 events per Measurement Protocol request. */
export const MP_MAX_EVENTS_PER_REQUEST = 25;

/**
 * Splits a batch into one {@link MpPayload} per session (a request carries a
 * single `client_id`), each capped at {@link MP_MAX_EVENTS_PER_REQUEST}
 * events. Order within a session is preserved.
 */
export function toMpPayloads(events: readonly AnalyticsEvent[]): MpPayload[] {
  const bySession = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const group = bySession.get(event.sessionId);
    if (group) group.push(event);
    else bySession.set(event.sessionId, [event]);
  }

  const payloads: MpPayload[] = [];
  for (const [clientId, group] of bySession) {
    const timestampMicros = group.length > 0 ? group[0]!.ts * 1000 : undefined;
    for (let i = 0; i < group.length; i += MP_MAX_EVENTS_PER_REQUEST) {
      payloads.push({
        client_id: clientId,
        ...(timestampMicros !== undefined ? { timestamp_micros: timestampMicros } : {}),
        events: group.slice(i, i + MP_MAX_EVENTS_PER_REQUEST).map(toMpEvent),
      });
    }
  }
  return payloads;
}
