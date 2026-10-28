/**
 * A short grace period for a manual Buster press made immediately before the
 * weapon is ready. This improves input reliability without changing the fire
 * rate or allowing more than one deferred shot.
 */
export const MANUAL_BUSTER_BUFFER_MS = 120;
export const MANUAL_BUSTER_BUFFER_SECONDS = MANUAL_BUSTER_BUFFER_MS / 1_000;

export type ManualBusterBufferResolution = 'none' | 'waiting' | 'fire';

/**
 * Returns the buffer expiry timestamp, or 0 when the press should not queue.
 */
export function queueManualBusterInput(
  cooldownSeconds: number,
  nowMs: number,
): number {
  if (
    !Number.isFinite(cooldownSeconds)
    || !Number.isFinite(nowMs)
    || cooldownSeconds <= 0
    || cooldownSeconds > MANUAL_BUSTER_BUFFER_SECONDS
    || nowMs < 0
  ) {
    return 0;
  }

  return nowMs + MANUAL_BUSTER_BUFFER_MS;
}

/**
 * Resolves a previously queued press. The caller clears the buffer after a
 * `fire` or `none` result, making the deferred input one-shot.
 */
export function resolveManualBusterInput(
  expiresAtMs: number,
  nowMs: number,
  cooldownSeconds: number,
): ManualBusterBufferResolution {
  if (
    !Number.isFinite(expiresAtMs)
    || !Number.isFinite(nowMs)
    || !Number.isFinite(cooldownSeconds)
    || expiresAtMs <= 0
    || nowMs < 0
    || nowMs > expiresAtMs
  ) {
    return 'none';
  }

  return cooldownSeconds <= 0 ? 'fire' : 'waiting';
}
