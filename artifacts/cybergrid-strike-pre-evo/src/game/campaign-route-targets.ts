import type { Enemy } from './types';
import { getEnemyVisualSeed } from './enemy-identity';

// Route targets are presented as one aiming choice. A missing companion is
// pulled into the next simulation tick; publication stays hidden until both
// targets exist, so this cannot produce a one-sided visual swap.
export const CAMPAIGN_ROUTE_TARGET_REACQUIRE_DELAY_SECONDS = 0;
export const CAMPAIGN_ROUTE_TARGET_PAIR_SPAWN_DELAY_SECONDS = 0;
export const CAMPAIGN_ROUTE_TARGET_MIN_ACQUISITION_COL = 4.2;
/** Published route objectives wait here until the player resolves the fork. */
export const CAMPAIGN_ROUTE_TARGET_HOLD_COL = 3.65;

export function advanceCampaignRouteTargetColumn(
  currentCol: number,
  travelDistance: number,
  pinned: boolean,
  holdColumn = CAMPAIGN_ROUTE_TARGET_HOLD_COL,
): number {
  const advanced = currentCol - travelDistance;
  return pinned ? Math.max(holdColumn, advanced) : advanced;
}

/** Reapply a route lane after state replacement, including Chrona rewind. */
export function pinCampaignRouteTargetLane(enemy: Enemy, row: number): number {
  const pinnedRow = Math.max(0, Math.min(2, Math.round(row)));
  enemy.row = pinnedRow;
  enemy.strategyTargetRow = pinnedRow;
  enemy.strategyAbilityTargetRow = pinnedRow;
  return pinnedRow;
}

export type CampaignRouteTargetDirection = 'last' | 'next';

export interface CampaignRouteTargetIdentity {
  enemy: Enemy;
  visualSeed: number;
}

export interface CampaignRouteTargetPair<T> {
  last: T;
  next: T;
}

/**
 * A route choice is publishable only as an atomic Last/Next pair. Consumers
 * must use this snapshot instead of reading each mutable binding separately.
 */
export function getCompleteCampaignRouteTargetPair<T>(
  targets: { last: T | null; next: T | null },
): CampaignRouteTargetPair<T> | null {
  const { last, next } = targets;
  return last !== null && next !== null ? { last, next } : null;
}

export type CampaignRouteTargetPresence =
  | { status: 'live'; enemy: Enemy }
  | { status: 'defeated'; enemy: Enemy }
  | { status: 'missing'; enemy: null };

export function findCampaignRouteTarget(
  enemies: readonly Enemy[],
  target: CampaignRouteTargetIdentity,
): Enemy | undefined {
  return enemies.find((enemy) => getEnemyVisualSeed(enemy) === target.visualSeed);
}

export function reconcileCampaignRouteTarget(
  enemies: readonly Enemy[],
  target: CampaignRouteTargetIdentity,
): CampaignRouteTargetPresence {
  const liveMatch = findCampaignRouteTarget(enemies, target);
  if (liveMatch) {
    return liveMatch.hp <= 0
      ? { status: 'defeated', enemy: liveMatch }
      : { status: 'live', enemy: liveMatch };
  }
  return target.enemy.hp <= 0
    ? { status: 'defeated', enemy: target.enemy }
    : { status: 'missing', enemy: null };
}

export function isCampaignRouteTarget(
  enemy: Enemy,
  targets: readonly (CampaignRouteTargetIdentity | null)[],
): boolean {
  const seed = getEnemyVisualSeed(enemy);
  return targets.some((target) => target?.visualSeed === seed);
}

/**
 * Objectives are acquired only from the enemy half of the board. This keeps a
 * newly presented Last/Next portrait on screen long enough to be recognized
 * and prevents an almost-expired enemy from becoming a one-frame objective.
 */
export function campaignRouteTargetCandidates(enemies: readonly Enemy[]): Enemy[] {
  return enemies
    .filter((enemy) => (
      enemy.colPos >= CAMPAIGN_ROUTE_TARGET_MIN_ACQUISITION_COL
      && enemy.hp > 0
      && Boolean(enemy.genome)
    ))
    .sort((left, right) => left.colPos - right.colPos || left.row - right.row);
}

/**
 * Pick a target whose lane can be aimed independently from the surviving
 * opposite objective. LAST remains the nearer safe target and NEXT the farther
 * target, so their screen-space meaning remains deterministic.
 */
export function selectCampaignRouteTargetCandidate(
  enemies: readonly Enemy[],
  direction: CampaignRouteTargetDirection,
  usedSeeds: ReadonlySet<number>,
  avoidRow?: number,
): Enemy | undefined {
  const unclaimed = campaignRouteTargetCandidates(enemies)
    .filter((enemy) => !usedSeeds.has(getEnemyVisualSeed(enemy)));
  const independentlyAimable = avoidRow === undefined
    ? unclaimed
    : unclaimed.filter((enemy) => enemy.row !== avoidRow);
  const aimPool = independentlyAimable.length > 0 ? independentlyAimable : unclaimed;
  if (aimPool.length === 0) return undefined;
  return direction === 'last'
    ? aimPool[0]
    : aimPool[aimPool.length - 1];
}
