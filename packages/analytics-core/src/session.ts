/** How long a session survives with no activity — a sliding window. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface SessionState {
  readonly id: string;
  /** Epoch ms this session first started — stable while the window slides. */
  readonly startedAt: number;
  /** Epoch ms of the most recent activity; the window is measured from here. */
  readonly lastSeenAt: number;
}

export interface DeriveSessionOptions {
  /** The stored state, or `null` for a first-ever event. */
  readonly previous: SessionState | null;
  /** Now, epoch ms. */
  readonly now: number;
  /** Mints a new id when a session must start. */
  readonly freshId: () => string;
}

/**
 * The session to attribute an event to: the previous one, its window slid
 * forward, when the gap since `lastSeenAt` is under {@link SESSION_IDLE_MS};
 * a brand-new session otherwise. Pure — the caller owns storage.
 */
export function deriveSession({ previous, now, freshId }: DeriveSessionOptions): SessionState {
  if (previous && now - previous.lastSeenAt < SESSION_IDLE_MS) {
    return { ...previous, lastSeenAt: now };
  }
  return { id: freshId(), startedAt: now, lastSeenAt: now };
}

/** FNV-1a, 32-bit — a fast, stable, non-crypto string hash for bucketing. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Whether this session is in the sample, deterministically — a session is
 * wholly in or wholly out, and the same id always decides the same way, so a
 * journey is never half-recorded. `rate` is clamped to `[0, 1]`.
 */
export function isSampled(sessionId: string, rate: number): boolean {
  if (!(rate > 0)) return false;
  if (rate >= 1) return true;
  return hashString(sessionId) / 0xffffffff < rate;
}
