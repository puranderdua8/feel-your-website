import type { AnalyticsEvent } from "@feel-your-website/analytics-core";
import { describe, expect, it, vi } from "vitest";

import { MeasurementProtocolSink } from "./MeasurementProtocolSink.js";

const event = (over: { sessionId: string; seq: number }): AnalyticsEvent => ({
  type: "page",
  path: "/p",
  ts: 1_700_000_000_000,
  ...over,
});

function okFetch() {
  return vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
}

const opts = (fetchImpl: typeof fetch) => ({
  measurementId: "G-TEST",
  apiSecret: "secret",
  fetchImpl,
});

describe("MeasurementProtocolSink", () => {
  it("POSTs the measurement id and api secret in the query, JSON body", async () => {
    const fetchImpl = okFetch();
    const sink = new MeasurementProtocolSink(opts(fetchImpl));

    const accepted = await sink.deliver([event({ sessionId: "s1", seq: 1 })]);

    expect(accepted).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toContain("measurement_id=G-TEST");
    expect(url).toContain("api_secret=secret");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.client_id).toBe("s1");
    expect(body.events[0].name).toBe("page_view");
  });

  it("sends one request per session", async () => {
    const fetchImpl = okFetch();
    const sink = new MeasurementProtocolSink(opts(fetchImpl));

    await sink.deliver([
      event({ sessionId: "s1", seq: 1 }),
      event({ sessionId: "s2", seq: 1 }),
      event({ sessionId: "s1", seq: 2 }),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("resolves true without a request for an empty batch", async () => {
    const fetchImpl = okFetch();
    const sink = new MeasurementProtocolSink(opts(fetchImpl));

    expect(await sink.deliver([])).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resolves false when GA returns a non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    const sink = new MeasurementProtocolSink(opts(fetchImpl));

    expect(await sink.deliver([event({ sessionId: "s1", seq: 1 })])).toBe(false);
  });

  it("resolves false when fetch rejects, and does not throw", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));
    const sink = new MeasurementProtocolSink(opts(fetchImpl));

    await expect(sink.deliver([event({ sessionId: "s1", seq: 1 })])).resolves.toBe(false);
  });

  it("resolves false if any session's request fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const sink = new MeasurementProtocolSink(opts(fetchImpl));

    const accepted = await sink.deliver([
      event({ sessionId: "s1", seq: 1 }),
      event({ sessionId: "s2", seq: 1 }),
    ]);
    expect(accepted).toBe(false);
  });

  it("aborts a slow request and resolves false", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockImplementation(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const sink = new MeasurementProtocolSink({ ...opts(fetchImpl), timeoutMs: 50 });

    const promise = sink.deliver([event({ sessionId: "s1", seq: 1 })]);
    await vi.advanceTimersByTimeAsync(60);
    await expect(promise).resolves.toBe(false);
    vi.useRealTimers();
  });
});
