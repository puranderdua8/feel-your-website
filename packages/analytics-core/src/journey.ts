/**
 * A monotonic per-session sequence. The provider stamps `seq` on every event
 * so the journey can be reassembled in order even if the batches that carry it
 * arrive out of order (or partly fail).
 */
export interface JourneyCounter {
  /**
   * The next `seq` for `sessionId`, starting at 1. Switching to a different
   * session id restarts the count — a new session is a new journey.
   */
  next(sessionId: string): number;
}

export function createJourneyCounter(): JourneyCounter {
  let currentSession: string | null = null;
  let seq = 0;

  return {
    next(sessionId: string): number {
      if (sessionId !== currentSession) {
        currentSession = sessionId;
        seq = 0;
      }
      seq += 1;
      return seq;
    },
  };
}
