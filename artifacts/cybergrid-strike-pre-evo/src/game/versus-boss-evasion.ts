import { COMPETITIVE_RULESET } from './competitive-balance';

export interface VersusBossProjectileThreat {
  row: number;
  colPos: number;
  speed: number;
  power: number;
  big: boolean;
  hitNpc?: boolean;
}

export interface VersusBossEvasionContext {
  npcRow: number;
  npcCol: number;
  playerRow: number;
  npcBoardCol: number;
  /** Strategy-selected depth inside the NPC's own three-column half. */
  preferredColumn: number;
  step: number;
  moveReady: boolean;
  decisionUnlocked: boolean;
  projectiles: readonly VersusBossProjectileThreat[];
}

export interface VersusBossEvasionPlan {
  fromRow: number;
  nextRow: number;
  fromColumn: number;
  nextColumn: number;
  impactEta: number;
  threatByRow: readonly [number, number, number];
  moveRecovery: number;
  fireRecovery: number;
}

const clampRow = (row: number): number => Math.max(0, Math.min(2, Math.round(row)));
const clampColumn = (column: number): number => Math.max(0, Math.min(2, Math.round(column)));

function contactEta(
  projectile: VersusBossProjectileThreat,
  npcBoardCol: number,
): number | null {
  if (!Number.isFinite(projectile.colPos)
    || !Number.isFinite(projectile.speed)
    || projectile.speed <= 0
    || projectile.hitNpc) return null;
  const collisionRadius = projectile.big ? 0.52 : 0.38;
  const eta = (npcBoardCol - projectile.colPos - collisionRadius) / projectile.speed;
  return Number.isFinite(eta) ? eta : null;
}

/** A shot already inside the no-reflex window must resolve before roaming. */
export function versusBossImpactIsCommitted(
  context: Pick<VersusBossEvasionContext, 'npcRow' | 'npcBoardCol' | 'projectiles'>,
): boolean {
  const currentRow = clampRow(context.npcRow);
  return context.projectiles.some((projectile) => {
    if (clampRow(projectile.row) !== currentRow || projectile.hitNpc || projectile.speed <= 0) {
      return false;
    }
    const collisionRadius = projectile.big ? 0.52 : 0.38;
    const centerDistance = context.npcBoardCol - projectile.colPos;
    if (centerDistance < -collisionRadius) return false;
    const eta = contactEta(projectile, context.npcBoardCol);
    return eta !== null && eta < COMPETITIVE_RULESET.npcDodgeReactionMin;
  });
}

/**
 * Resolves the same defensive choice available to a human opponent: move one
 * adjacent lane after a projectile becomes readable, then remain committed.
 * It deliberately rejects spawn-time input reading and last-frame teleports.
 */
export function planVersusBossEvasion(
  context: VersusBossEvasionContext,
): VersusBossEvasionPlan | null {
  if (!context.moveReady || !context.decisionUnlocked) return null;

  const currentRow = clampRow(context.npcRow);
  const threatByRow: [number, number, number] = [0, 0, 0];
  let imminentImpactEta = Number.POSITIVE_INFINITY;

  for (const projectile of context.projectiles) {
    const row = clampRow(projectile.row);
    const eta = contactEta(projectile, context.npcBoardCol);
    if (eta === null || eta < COMPETITIVE_RULESET.npcDodgeReactionMin) continue;
    if (eta <= COMPETITIVE_RULESET.npcDodgeLookahead) {
      threatByRow[row] += Math.max(1, projectile.power) + (projectile.big ? 1 : 0);
    }
    if (row === currentRow && eta <= COMPETITIVE_RULESET.npcDodgeReactionMax) {
      imminentImpactEta = Math.min(imminentImpactEta, eta);
    }
  }

  if (!Number.isFinite(imminentImpactEta)) return null;

  const adjacentRows = [currentRow - 1, currentRow + 1]
    .filter((row) => row >= 0 && row <= 2);
  const currentThreat = threatByRow[currentRow];
  const saferRows = adjacentRows.filter((row) => threatByRow[row] < currentThreat);
  if (saferRows.length === 0) return null;

  saferRows.sort((left, right) => {
    const threatDelta = threatByRow[left] - threatByRow[right];
    if (threatDelta !== 0) return threatDelta;
    const playerDistanceDelta = Math.abs(right - context.playerRow)
      - Math.abs(left - context.playerRow);
    if (playerDistanceDelta !== 0) return playerDistanceDelta;
    const parityPreference = Math.abs(context.step) % 2 === 0 ? 1 : -1;
    return parityPreference * (left - right);
  });

  return {
    fromRow: currentRow,
    nextRow: saferRows[0] ?? currentRow,
    fromColumn: clampColumn(context.npcCol),
    // A reactive dodge still follows the selected skin's depth doctrine. The
    // one-cell bound keeps this a readable diagonal step rather than a random
    // teleport across the NPC half of the board.
    nextColumn: clampColumn(
      clampColumn(context.npcCol)
        + Math.sign(clampColumn(context.preferredColumn) - clampColumn(context.npcCol)),
    ),
    impactEta: imminentImpactEta,
    threatByRow,
    moveRecovery: COMPETITIVE_RULESET.npcDodgeRecovery,
    fireRecovery: COMPETITIVE_RULESET.npcDodgeFireRecovery,
  };
}
