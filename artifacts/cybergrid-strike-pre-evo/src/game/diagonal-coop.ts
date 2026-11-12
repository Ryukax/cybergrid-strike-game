export const DIAGONAL_COOP_GRID_MIN = 0;
export const DIAGONAL_COOP_GRID_MAX = 2;

export type DiagonalCoopPlayer = 'p1' | 'p2';

export interface DiagonalCoopCell {
  readonly col: number;
  readonly row: number;
}

export interface DiagonalCoopPositions {
  readonly p1: DiagonalCoopCell;
  readonly p2: DiagonalCoopCell;
}

export interface DiagonalCoopMoveIntents {
  readonly p1?: DiagonalCoopCell | null;
  readonly p2?: DiagonalCoopCell | null;
}

export type DiagonalCoopOffset = -1 | 1;

/**
 * P1's visual corner while both actors share a tile. P2 always occupies the
 * opposite corner. Keeping this separate from board position lets both actors
 * continue to own and update their own cells.
 */
export interface DiagonalCoopPairLayout {
  readonly playerX: DiagonalCoopOffset;
  readonly playerY: DiagonalCoopOffset;
}

export type DiagonalCoopMoveRejection = 'out-of-bounds';

export interface DiagonalCoopMovementResolution {
  readonly positions: DiagonalCoopPositions;
  readonly moved: Readonly<Record<DiagonalCoopPlayer, boolean>>;
  readonly rejected: Readonly<
    Record<DiagonalCoopPlayer, DiagonalCoopMoveRejection | null>
  >;
  readonly layout: DiagonalCoopPairLayout | null;
}

const DIAGONAL_COOP_P1_SPAWN: DiagonalCoopCell = { col: 0, row: 0 };
const DIAGONAL_COOP_P2_SPAWN: DiagonalCoopCell = { col: 2, row: 2 };

export const DEFAULT_DIAGONAL_COOP_PAIR_LAYOUT: DiagonalCoopPairLayout = {
  playerX: -1,
  playerY: -1,
};

function copyCell(cell: DiagonalCoopCell): DiagonalCoopCell {
  return { col: cell.col, row: cell.row };
}

export function sameDiagonalCoopCell(
  left: DiagonalCoopCell,
  right: DiagonalCoopCell,
): boolean {
  return left.col === right.col && left.row === right.row;
}

/** P1 and the autonomous ally enter the board from opposite corners. */
export function createDiagonalCoopSpawns(): DiagonalCoopPositions {
  return {
    p1: copyCell(DIAGONAL_COOP_P1_SPAWN),
    p2: copyCell(DIAGONAL_COOP_P2_SPAWN),
  };
}

export function isDiagonalCoopCellInBounds(cell: DiagonalCoopCell): boolean {
  return Number.isInteger(cell.col)
    && Number.isInteger(cell.row)
    && cell.col >= DIAGONAL_COOP_GRID_MIN
    && cell.col <= DIAGONAL_COOP_GRID_MAX
    && cell.row >= DIAGONAL_COOP_GRID_MIN
    && cell.row <= DIAGONAL_COOP_GRID_MAX;
}

function assertValidPositions(positions: DiagonalCoopPositions): void {
  if (!isDiagonalCoopCellInBounds(positions.p1)
    || !isDiagonalCoopCellInBounds(positions.p2)) {
    throw new RangeError('Diagonal co-op actors must remain inside the 3x3 grid');
  }
}

function signOffset(value: number): DiagonalCoopOffset | null {
  if (value < 0) return -1;
  if (value > 0) return 1;
  return null;
}

/**
 * Derive the persistent intra-cell diagonal when the actors first collide.
 *
 * Their pre-collision relative position chooses P1's corner. If they met from
 * a cardinal direction, the missing axis follows the known axis, producing a
 * stable NW/SE diagonal rather than allowing the sprites to overlap. Once the
 * pair is co-located, the existing layout is retained until they separate.
 */
export function resolveDiagonalCoopPairLayout(
  previous: DiagonalCoopPositions,
  next: DiagonalCoopPositions,
  previousLayout: DiagonalCoopPairLayout | null = null,
): DiagonalCoopPairLayout | null {
  assertValidPositions(previous);
  assertValidPositions(next);

  if (!sameDiagonalCoopCell(next.p1, next.p2)) return null;
  if (sameDiagonalCoopCell(previous.p1, previous.p2)) {
    return previousLayout ?? DEFAULT_DIAGONAL_COOP_PAIR_LAYOUT;
  }

  const relativeX = signOffset(previous.p1.col - previous.p2.col);
  const relativeY = signOffset(previous.p1.row - previous.p2.row);
  const fallback = relativeX ?? relativeY ?? -1;

  return {
    playerX: relativeX ?? fallback,
    playerY: relativeY ?? fallback,
  };
}

/**
 * Resolve P1 and P2 independently. Either actor may move, hold, swap cells,
 * or enter the other actor's cell. An invalid intent rejects only its owner.
 */
export function resolveDiagonalCoopMovement(
  current: DiagonalCoopPositions,
  intents: DiagonalCoopMoveIntents,
  currentLayout: DiagonalCoopPairLayout | null = null,
): DiagonalCoopMovementResolution {
  assertValidPositions(current);

  const rejected: Record<DiagonalCoopPlayer, DiagonalCoopMoveRejection | null> = {
    p1: null,
    p2: null,
  };

  const resolveActor = (
    player: DiagonalCoopPlayer,
    intent: DiagonalCoopCell | null | undefined,
  ): DiagonalCoopCell => {
    if (intent === undefined || intent === null) return copyCell(current[player]);
    if (!isDiagonalCoopCellInBounds(intent)) {
      rejected[player] = 'out-of-bounds';
      return copyCell(current[player]);
    }
    return copyCell(intent);
  };

  const positions: DiagonalCoopPositions = {
    p1: resolveActor('p1', intents.p1),
    p2: resolveActor('p2', intents.p2),
  };

  return {
    positions,
    moved: {
      p1: !sameDiagonalCoopCell(current.p1, positions.p1),
      p2: !sameDiagonalCoopCell(current.p2, positions.p2),
    },
    rejected,
    layout: resolveDiagonalCoopPairLayout(current, positions, currentLayout),
  };
}
