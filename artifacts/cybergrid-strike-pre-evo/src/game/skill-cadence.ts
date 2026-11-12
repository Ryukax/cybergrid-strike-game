import type { GameMode } from './types';

/**
 * A hand is spent as soon as every dealt card has been used. Individual card
 * cooldowns continue independently while the next hand charges; they must not
 * serialize a second wait in front of the hand recharge.
 */
export function abilityHandIsSpent(
  hand: readonly string[],
  usedAbilityIds: readonly string[],
): boolean {
  if (hand.length === 0) return false;
  const used = new Set(usedAbilityIds);
  return hand.every((abilityId) => used.has(abilityId));
}

/** Never expose an active card hand with no usable choices. */
export function abilityHandCanPublish(hand: readonly string[]): boolean {
  return hand.length > 0;
}

export interface SignatureActionAttempt {
  readonly accepted: boolean;
  readonly reason: 'accepted' | 'inactive' | 'budget' | 'recovery';
  readonly nextReadyAtMs: number;
}

/**
 * Resolve signature input before mutating animation or gameplay state so a
 * rejected press cannot display a move that never occurred.
 */
export function resolveSignatureActionAttempt(input: {
  readonly active: boolean;
  readonly actionCount: number;
  readonly maxActions: number;
  readonly nowMs: number;
  readonly readyAtMs: number;
  readonly intervalMs: number;
}): SignatureActionAttempt {
  if (!input.active) {
    return { accepted: false, reason: 'inactive', nextReadyAtMs: input.readyAtMs };
  }
  if (input.actionCount >= input.maxActions) {
    return { accepted: false, reason: 'budget', nextReadyAtMs: input.readyAtMs };
  }
  if (input.nowMs < input.readyAtMs) {
    return { accepted: false, reason: 'recovery', nextReadyAtMs: input.readyAtMs };
  }
  return {
    accepted: true,
    reason: 'accepted',
    nextReadyAtMs: input.nowMs + Math.max(0, input.intervalMs),
  };
}

/**
 * Competitive signature recovery is measured activation-to-activation. The
 * active command window therefore consumes part of the declared cooldown.
 */
export function startSignatureRecovery(
  mode: GameMode,
  configuredSeconds: number,
): number {
  if (mode !== 'vs') return 0;
  return Math.max(0, Number.isFinite(configuredSeconds) ? configuredSeconds : 0);
}

export function advanceSkillRecovery(
  remainingSeconds: number,
  elapsedSeconds: number,
): number {
  const remaining = Number.isFinite(remainingSeconds) ? remainingSeconds : 0;
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  return Math.max(0, remaining - Math.max(0, elapsed));
}
