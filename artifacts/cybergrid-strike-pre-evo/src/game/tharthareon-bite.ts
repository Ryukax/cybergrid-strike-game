/**
 * Pure simulation helpers for Tharthareon's short head-lunge carrier.
 * Rendering is deliberately absent: the same bounded coordinates drive both
 * gameplay collision and whichever authored head sequence presents them.
 */

export const THARTHAREON_BITE_MAX_CELLS = 3;
export const THARTHAREON_BITE_SPEED_CELLS_PER_SECOND = 3.75;
export const THARTHAREON_BITE_OPEN_HOLD_SECONDS = 0.18;
export const THARTHAREON_BITE_CLAMP_HOLD_SECONDS = 0.34;
export const THARTHAREON_BITE_FINAL_HOLD_SECONDS =
  THARTHAREON_BITE_OPEN_HOLD_SECONDS + THARTHAREON_BITE_CLAMP_HOLD_SECONDS;
/** The authored double-tap headbutt is one 25-frame, 1.33 second cycle. */
export const THARTHAREON_HEADBUTT_SEQUENCE_DURATION_SECONDS = 1.33;
/** A collided live target can remain clamped only while input is held. */
export const THARTHAREON_TARGET_HOLD_MAX_SECONDS = 3;

export interface TharthareonBiteAdvance {
  readonly previousColumn: number;
  readonly column: number;
  readonly endpointColumn: number;
  readonly complete: boolean;
}

export type TharthareonTargetHoldEndReason =
  | 'held'
  | 'input-release'
  | 'target-lost'
  | 'timeout';

export interface TharthareonTargetHoldAdvance {
  readonly elapsedSeconds: number;
  readonly remainingSeconds: number;
  readonly active: boolean;
  readonly reason: TharthareonTargetHoldEndReason;
}

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/** Advance toward, but never beyond, the carrier's three-cell endpoint. */
export function advanceTharthareonBiteCarrier(
  currentColumn: number,
  originColumn: number,
  speed: number,
  deltaSeconds: number,
  maximumCells = THARTHAREON_BITE_MAX_CELLS,
): TharthareonBiteAdvance {
  const origin = finiteOr(originColumn, 0);
  const current = finiteOr(currentColumn, origin);
  const velocity = finiteOr(speed, 0);
  const direction = Math.sign(velocity) || 1;
  const range = Math.max(0, finiteOr(maximumCells, THARTHAREON_BITE_MAX_CELLS));
  const endpointColumn = origin + direction * range;
  const candidate = current + velocity * Math.max(0, finiteOr(deltaSeconds, 0));
  const complete = direction > 0
    ? candidate >= endpointColumn
    : candidate <= endpointColumn;
  return {
    previousColumn: current,
    column: complete ? endpointColumn : candidate,
    endpointColumn,
    complete,
  };
}

/**
 * Continuous horizontal overlap for the large head carrier. This supplements
 * (rather than changes) the point-sampled collision used by ordinary bullets,
 * so a dropped frame cannot skip an enemy between two positions.
 */
export function tharthareonBiteSweptCollision(
  previousColumn: number,
  currentColumn: number,
  targetColumn: number,
  collisionRadius: number,
): boolean {
  if (![previousColumn, currentColumn, targetColumn, collisionRadius].every(Number.isFinite)) {
    return false;
  }
  const radius = Math.max(0, collisionRadius);
  const minimum = Math.min(previousColumn, currentColumn) - radius;
  const maximum = Math.max(previousColumn, currentColumn) + radius;
  return targetColumn >= minimum && targetColumn <= maximum;
}

/** Advance the simulation-owned final bite hold without ever going negative. */
export function advanceTharthareonBiteHold(
  remainingSeconds: number,
  deltaSeconds: number,
): number {
  const remaining = Math.max(0, finiteOr(remainingSeconds, 0));
  const delta = Math.max(0, finiteOr(deltaSeconds, 0));
  return Math.max(0, remaining - delta);
}

/**
 * Advance a bite that has already clamped onto a real game entity.
 *
 * The caller owns target identity and placement; this helper owns only the
 * deterministic input/timeout contract. Releasing the input or losing the
 * bound entity ends the clamp immediately, while uninterrupted input can
 * never retain a target for more than three seconds.
 */
export function advanceTharthareonTargetHold(
  elapsedSeconds: number,
  deltaSeconds: number,
  inputHeld: boolean,
  targetPresent: boolean,
  maximumSeconds = THARTHAREON_TARGET_HOLD_MAX_SECONDS,
): TharthareonTargetHoldAdvance {
  const maximum = Math.max(0, finiteOr(maximumSeconds, THARTHAREON_TARGET_HOLD_MAX_SECONDS));
  const elapsed = Math.min(maximum, Math.max(0, finiteOr(elapsedSeconds, 0)));
  if (!targetPresent) {
    return {
      elapsedSeconds: elapsed,
      remainingSeconds: 0,
      active: false,
      reason: 'target-lost',
    };
  }
  if (!inputHeld) {
    return {
      elapsedSeconds: elapsed,
      remainingSeconds: 0,
      active: false,
      reason: 'input-release',
    };
  }
  const nextElapsed = Math.min(
    maximum,
    elapsed + Math.max(0, finiteOr(deltaSeconds, 0)),
  );
  const remainingSeconds = Math.max(0, maximum - nextElapsed);
  const active = remainingSeconds > 0;
  return {
    elapsedSeconds: nextElapsed,
    remainingSeconds,
    active,
    reason: active ? 'held' : 'timeout',
  };
}
