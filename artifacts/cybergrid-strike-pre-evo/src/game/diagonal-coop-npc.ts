import {
  DIAGONAL_COOP_GRID_MAX,
  DIAGONAL_COOP_GRID_MIN,
  isDiagonalCoopCellInBounds,
  sameDiagonalCoopCell,
  type DiagonalCoopCell,
} from './diagonal-coop';

export interface DiagonalCoopNpcThreat {
  /** Continuous board column; the lowest value is the most urgent threat. */
  readonly col: number;
  readonly row: number;
  readonly hp?: number;
}

export interface DiagonalCoopNpcDecisionInput {
  readonly player: DiagonalCoopCell;
  readonly npc: DiagonalCoopCell;
  readonly threats: readonly DiagonalCoopNpcThreat[];
  readonly canMove: boolean;
  readonly canFire: boolean;
}

export interface DiagonalCoopNpcDecision {
  /** One independent NPC step, or null when holding its current cell. */
  readonly moveTo: DiagonalCoopCell | null;
  readonly shouldFire: boolean;
  /** Row of the selected urgent threat, useful for presentation/debugging. */
  readonly targetRow: number | null;
}

function selectUrgentThreat(
  threats: readonly DiagonalCoopNpcThreat[],
  npcRow: number,
): DiagonalCoopNpcThreat | null {
  const viable = threats.filter((threat) => Number.isFinite(threat.col)
    && Number.isInteger(threat.row)
    && threat.row >= DIAGONAL_COOP_GRID_MIN
    && threat.row <= DIAGONAL_COOP_GRID_MAX
    && (threat.hp === undefined || threat.hp > 0));

  if (viable.length === 0) return null;
  return [...viable].sort((left, right) => (
    left.col - right.col
    || Math.abs(left.row - npcRow) - Math.abs(right.row - npcRow)
    || left.row - right.row
  ))[0] ?? null;
}

function stepToward(current: number, target: number): number {
  if (current < target) return current + 1;
  if (current > target) return current - 1;
  return current;
}

/**
 * Deterministic independent companion policy.
 *
 * With no urgent lane, the NPC mirrors the player across the 3x3 center. A
 * living threat supplies the preferred row while the mirrored column remains
 * the formation goal. The policy deliberately does not reserve the player's
 * cell, so both actors may naturally converge and trigger a diagonal layout.
 */
export function chooseDiagonalCoopNpcDecision(
  input: DiagonalCoopNpcDecisionInput,
): DiagonalCoopNpcDecision {
  if (!isDiagonalCoopCellInBounds(input.player)
    || !isDiagonalCoopCellInBounds(input.npc)) {
    throw new RangeError('Diagonal co-op actors must remain inside the 3x3 grid');
  }

  const urgentThreat = selectUrgentThreat(input.threats, input.npc.row);
  const shouldFire = input.canFire && input.threats.some((threat) => (
    Number.isFinite(threat.col)
    && (threat.hp === undefined || threat.hp > 0)
    && threat.row === input.npc.row
  ));

  if (!input.canMove) {
    return {
      moveTo: null,
      shouldFire,
      targetRow: urgentThreat?.row ?? null,
    };
  }

  const preferred: DiagonalCoopCell = {
    col: DIAGONAL_COOP_GRID_MAX - input.player.col,
    row: urgentThreat?.row ?? DIAGONAL_COOP_GRID_MAX - input.player.row,
  };
  const moveTo: DiagonalCoopCell = {
    col: stepToward(input.npc.col, preferred.col),
    row: stepToward(input.npc.row, preferred.row),
  };

  return {
    moveTo: sameDiagonalCoopCell(input.npc, moveTo) ? null : moveTo,
    shouldFire,
    targetRow: urgentThreat?.row ?? null,
  };
}
